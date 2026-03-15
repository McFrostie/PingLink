# PingLink Supabase Schema — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a complete, production-ready Supabase PostgreSQL schema for PingLink — covering all 20+ screens — with tables, enums, indexes, RLS policies, triggers, storage buckets, and seed data in a single runnable migration set.

**Architecture:** Clean separation into 6 SQL migration files (run in order): enums + core tables → social + engagement tables → indexes → RLS policies → triggers/functions → storage + seed. Each file is idempotent (`IF NOT EXISTS`, `OR REPLACE`) so it can be re-run safely. React app connects via `@supabase/supabase-js`.

**Tech Stack:** Supabase (PostgreSQL 15 + PostGIS + Realtime + Storage), React 19 + TypeScript, `@supabase/supabase-js` v2, Vite env vars for keys.

---

## Screen → Data Mapping (reference)

| Screen | Tables read/written |
|---|---|
| Login / Register / ForgotPassword | `auth.users` (Supabase Auth) |
| ProfileSetup (Steps 1–4) | `profiles`, `user_availability` |
| HomeFeed | `profiles`, `activity_feed`, `user_venue_checkins`, `venues` |
| MapScreen | `venues`, `venue_photos`, `user_venue_checkins` |
| VenueFilter | `venues` (filtered query) |
| VenueDetail | `venues`, `venue_photos`, `venue_reviews`, `profiles`, `user_venue_checkins` |
| AddVenue | `venues`, `venue_photos` |
| PlayerSearch | `profiles`, `connections` (proximity + filter) |
| PlayerProfile | `profiles`, `user_availability`, `connections`, `user_preferred_venues`, `activity_feed` |
| ConnectionsList | `connections`, `profiles` |
| Notifications | `notifications` |
| Inbox (placeholder) | `conversations`, `messages` |
| Chat (placeholder) | `messages`, `conversations` |
| MyProfile | `profiles`, `user_availability`, `connections`, `matches`, `user_venue_checkins`, `user_achievements`, `achievements`, `activity_feed` |
| EditProfile | `profiles`, `user_availability`, `user_preferred_venues` |
| Settings | `profiles` (visibility/prefs), `notification_preferences` |

---

## File Structure

```
supabase/
└── migrations/
    ├── 001_enums_and_extensions.sql      — pg extensions + all custom enums
    ├── 002_core_tables.sql               — profiles, user_availability, venues, venue_photos, venue_reviews, user_venue_checkins, user_preferred_venues
    ├── 003_social_tables.sql             — connections, matches, conversations, messages, notifications, notification_preferences, activity_feed, achievements, user_achievements
    ├── 004_indexes.sql                   — all performance indexes (btree, gist, gin)
    ├── 005_rls_policies.sql              — Row Level Security for every table
    └── 006_triggers_functions_seed.sql   — DB functions, triggers, storage bucket setup, seed achievements
```

> **Why 6 files not 1?** Each concern can be re-applied independently. If a trigger needs changing, only run file 006. If an index needs adding, only run file 004. Easier to review in PRs.

---

## Chunk 1: Enums, Extensions, and Core Tables

### Task 1: Extensions & Enums

**Files:**
- Create: `supabase/migrations/001_enums_and_extensions.sql`

- [ ] **Step 1: Create the file**

```sql
-- supabase/migrations/001_enums_and_extensions.sql
-- Enable PostGIS for proximity queries
create extension if not exists postgis;

-- ─────────────────────────────────────────────
-- CUSTOM ENUMS
-- ─────────────────────────────────────────────

-- Player skill level (used in profiles + player search filters)
do $$ begin
  create type skill_level_enum as enum (
    'beginner', 'casual', 'intermediate', 'advanced', 'professional'
  );
exception when duplicate_object then null; end $$;

-- Venue facility type (AddVenue form + VenueFilter chips)
do $$ begin
  create type facility_type_enum as enum (
    'club', 'sports_center', 'community_hall', 'school', 'commercial'
  );
exception when duplicate_object then null; end $$;

-- Venue moderation state
do $$ begin
  create type venue_status_enum as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- Connection request lifecycle
do $$ begin
  create type connection_status_enum as enum (
    'pending', 'accepted', 'rejected', 'blocked'
  );
exception when duplicate_object then null; end $$;

-- Match lifecycle (MatchDetail screen status badge)
do $$ begin
  create type match_status_enum as enum (
    'pending', 'confirmed', 'cancelled', 'completed'
  );
exception when duplicate_object then null; end $$;

-- Availability time slots (ProfileSetup Step 4 + AvailabilitySettings)
do $$ begin
  create type time_of_day_enum as enum (
    'morning', 'afternoon', 'evening', 'night'
  );
exception when duplicate_object then null; end $$;

-- Notification types (Notifications screen filter chips)
do $$ begin
  create type notification_type_enum as enum (
    'connection_request',
    'connection_accepted',
    'match_request',
    'match_confirmed',
    'match_cancelled',
    'message',
    'venue_approved',
    'achievement_earned',
    'check_in'
  );
exception when duplicate_object then null; end $$;

-- Activity feed event types (HomeFeed cards)
do $$ begin
  create type activity_type_enum as enum (
    'match_played',
    'venue_added',
    'connection_made',
    'achievement_earned',
    'venue_reviewed',
    'checked_in'
  );
exception when duplicate_object then null; end $$;

-- Profile visibility (Settings → Privacy)
do $$ begin
  create type profile_visibility_enum as enum ('public', 'connections_only');
exception when duplicate_object then null; end $$;

-- Achievement category (MyProfile achievements grid)
do $$ begin
  create type achievement_category_enum as enum (
    'social', 'venues', 'matches', 'general'
  );
exception when duplicate_object then null; end $$;
```

- [ ] **Step 2: Verify in Supabase SQL Editor**

Run the file. Then confirm:
```sql
select typname from pg_type
where typname like '%_enum'
order by typname;
-- Expected: 10 rows (achievement_category_enum, activity_type_enum, connection_status_enum, facility_type_enum, match_status_enum, notification_type_enum, profile_visibility_enum, skill_level_enum, time_of_day_enum, venue_status_enum)

select * from pg_extension where extname = 'postgis';
-- Expected: 1 row
```

---

### Task 2: Profiles Table

**Files:**
- Modify: `supabase/migrations/002_core_tables.sql`

`profiles` is the central table — every other table references it. It extends Supabase Auth's `auth.users`.

- [ ] **Step 1: Add profiles table to 002_core_tables.sql**

```sql
-- supabase/migrations/002_core_tables.sql
-- ─────────────────────────────────────────────
-- PROFILES
-- Extends auth.users. Created automatically via trigger on signup.
-- ─────────────────────────────────────────────
create table if not exists profiles (
  -- Identity
  id                  uuid        primary key references auth.users(id) on delete cascade,
  username            text        unique not null check (
                                    username ~ '^[a-z0-9_]{3,30}$'
                                  ),
  full_name           text        not null check (char_length(full_name) between 2 and 100),

  -- Avatar + cover (Supabase Storage URLs)
  avatar_url          text,
  cover_url           text,       -- PlayerProfileScreen banner

  -- Bio (EditProfile, max 150 chars per spec)
  bio                 text        check (char_length(bio) <= 150),

  -- Demographics (ProfileSetup Step 1)
  date_of_birth       date,
  city                text,

  -- Location (stored flat + PostGIS column for proximity queries)
  latitude            float8,
  longitude           float8,
  location            geography(point, 4326),  -- updated via trigger when lat/lng change

  -- Skill & Style (ProfileSetup Steps 2–3)
  skill_level         skill_level_enum,
  playing_styles      text[]      not null default '{}',
  -- e.g. ['offensive','defensive','all_round']
  grips               text[]      not null default '{}',
  -- e.g. ['penhold','shakehand']
  techniques          text[]      not null default '{}',
  -- e.g. ['heavy_topspin','chopper','looper','blocker']

  -- Onboarding state (redirect guard in app)
  setup_complete      boolean     not null default false,

  -- Presence (online dot in chat/connections)
  is_online           boolean     not null default false,
  last_seen_at        timestamptz,

  -- Privacy settings (Settings → Privacy section)
  profile_visibility  profile_visibility_enum not null default 'public',
  show_location       boolean     not null default true,
  show_online_status  boolean     not null default true,

  -- Timestamps
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
```

- [ ] **Step 2: Verify table created correctly**

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'profiles'
order by ordinal_position;
-- Expected: all columns listed above
```

---

### Task 3: User Availability Table

**Files:**
- Append to: `supabase/migrations/002_core_tables.sql`

Drives ProfileSetup Step 4, AvailabilitySettings screen, and PlayerProfile read-only display.

- [ ] **Step 1: Append to 002_core_tables.sql**

```sql
-- ─────────────────────────────────────────────
-- USER AVAILABILITY
-- One row per (user, day, time_slot) — multi-select on Step 4.
-- ─────────────────────────────────────────────
create table if not exists user_availability (
  id           uuid            primary key default gen_random_uuid(),
  user_id      uuid            not null references profiles(id) on delete cascade,
  day_of_week  int             not null check (day_of_week between 0 and 6),
  -- 0 = Monday … 6 = Sunday (matches ProfileSetup chip order)
  time_of_day  time_of_day_enum not null,
  unique (user_id, day_of_week, time_of_day)
);
```

---

### Task 4: Venues Table

**Files:**
- Append to: `supabase/migrations/002_core_tables.sql`

Core of Phase 4. Powers MapScreen markers, VenueDetail, VenueFilter.

- [ ] **Step 1: Append venues table**

```sql
-- ─────────────────────────────────────────────
-- VENUES
-- ─────────────────────────────────────────────
create table if not exists venues (
  id                uuid              primary key default gen_random_uuid(),

  -- Basic info (AddVenue form)
  name              text              not null check (char_length(name) between 2 and 150),
  address           text              not null,

  -- Location
  latitude          float8            not null,
  longitude         float8            not null,
  location          geography(point, 4326) not null,

  -- Classification (AddVenue dropdown + VenueFilter chips)
  facility_type     facility_type_enum,
  description       text              check (char_length(description) <= 300),
  num_tables        int               not null default 0 check (num_tables >= 0),
  amenities         text[]            not null default '{}',
  -- e.g. ['parking','coaching','equipment_rental','changing_rooms','cafeteria','bar','pro_shop']

  -- Contact (optional, AddVenue form)
  contact_phone     text,
  contact_website   text,

  -- Opening hours (VenueDetail status badge)
  -- Format: {"mon":{"open":"09:00","close":"22:00"}, "tue":{...}, ...}
  -- Keys: mon tue wed thu fri sat sun
  opening_hours     jsonb             default '{}',

  -- Moderation
  submitted_by      uuid              references profiles(id) on delete set null,
  status            venue_status_enum not null default 'pending',
  is_verified       boolean           not null default false,

  -- Computed stats (updated by trigger)
  average_rating    float4            not null default 0 check (average_rating between 0 and 5),
  review_count      int               not null default 0 check (review_count >= 0),
  checkin_count     int               not null default 0 check (checkin_count >= 0),
  -- ^ live "Players Here" count on VenueDetail

  created_at        timestamptz       not null default now(),
  updated_at        timestamptz       not null default now()
);
```

---

### Task 5: Venue Photos Table

**Files:**
- Append to: `supabase/migrations/002_core_tables.sql`

Gallery in VenueDetail (swipeable full-width). Up to 5 per venue per spec.

- [ ] **Step 1: Append venue_photos table**

```sql
-- ─────────────────────────────────────────────
-- VENUE PHOTOS
-- ─────────────────────────────────────────────
create table if not exists venue_photos (
  id            uuid        primary key default gen_random_uuid(),
  venue_id      uuid        not null references venues(id) on delete cascade,
  url           text        not null,             -- Supabase Storage public URL
  is_primary    boolean     not null default false,
  display_order int         not null default 0,   -- sort for gallery
  uploaded_by   uuid        references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
```

---

### Task 6: Venue Reviews Table

**Files:**
- Append to: `supabase/migrations/002_core_tables.sql`

VenueDetail → "Write a Review" and star breakdown.

- [ ] **Step 1: Append venue_reviews table**

```sql
-- ─────────────────────────────────────────────
-- VENUE REVIEWS
-- One review per user per venue (unique constraint).
-- average_rating on venues is recalculated by trigger.
-- ─────────────────────────────────────────────
create table if not exists venue_reviews (
  id          uuid        primary key default gen_random_uuid(),
  venue_id    uuid        not null references venues(id) on delete cascade,
  user_id     uuid        not null references profiles(id) on delete cascade,
  rating      int         not null check (rating between 1 and 5),
  comment     text        check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (venue_id, user_id)
);
```

---

### Task 7: Check-ins & Preferred Venues Tables

**Files:**
- Append to: `supabase/migrations/002_core_tables.sql`

`user_venue_checkins` powers VenueDetail → "I Play Here" toggle and "Players Here" list.
`user_preferred_venues` powers PlayerProfile → Preferred Venues section and EditProfile.

- [ ] **Step 1: Append both tables**

```sql
-- ─────────────────────────────────────────────
-- USER VENUE CHECK-INS
-- Active check-in: one per user at any time.
-- Used for "I Play Here" toggle + "Players Here" avatar list.
-- ─────────────────────────────────────────────
create table if not exists user_venue_checkins (
  user_id       uuid        not null references profiles(id) on delete cascade,
  venue_id      uuid        not null references venues(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

-- ─────────────────────────────────────────────
-- USER PREFERRED VENUES
-- Static list shown on PlayerProfile + EditProfile.
-- Unlike checkins, these persist.
-- ─────────────────────────────────────────────
create table if not exists user_preferred_venues (
  user_id    uuid        not null references profiles(id) on delete cascade,
  venue_id   uuid        not null references venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);
```

- [ ] **Step 2: Verify entire 002 file in Supabase SQL Editor**

```sql
select tablename from pg_tables
where schemaname = 'public'
order by tablename;
-- Expected includes: profiles, user_availability, venues, venue_photos,
--                    venue_reviews, user_venue_checkins, user_preferred_venues
```

---

## Chunk 2: Social & Engagement Tables

### Task 8: Connections Table

**Files:**
- Create: `supabase/migrations/003_social_tables.sql`

Powers ConnectionsListScreen (3 tabs: Connections / Requests / Sent) and PlayerSearch "Connect" button.

- [ ] **Step 1: Create 003_social_tables.sql with connections**

```sql
-- supabase/migrations/003_social_tables.sql
-- ─────────────────────────────────────────────
-- CONNECTIONS
-- Directed relationship: requester → addressee.
-- Status transitions: pending → accepted | rejected | blocked
-- ─────────────────────────────────────────────
create table if not exists connections (
  id            uuid                    primary key default gen_random_uuid(),
  requester_id  uuid                    not null references profiles(id) on delete cascade,
  addressee_id  uuid                    not null references profiles(id) on delete cascade,
  status        connection_status_enum  not null default 'pending',
  created_at    timestamptz             not null default now(),
  updated_at    timestamptz             not null default now(),
  unique (requester_id, addressee_id),
  -- Prevent self-connection
  check (requester_id <> addressee_id)
);
```

---

### Task 9: Matches Table

**Files:**
- Append to: `supabase/migrations/003_social_tables.sql`

Powers MatchSchedulingScreen (Steps 1–4) and MatchDetailScreen (status badge + actions).

- [ ] **Step 1: Append matches table**

```sql
-- ─────────────────────────────────────────────
-- MATCHES
-- Private 1v1 match between two connected players.
-- created_by = player who initiated (player1_id)
-- ─────────────────────────────────────────────
create table if not exists matches (
  id            uuid              primary key default gen_random_uuid(),
  player1_id    uuid              not null references profiles(id) on delete cascade,
  player2_id    uuid              not null references profiles(id) on delete cascade,
  venue_id      uuid              references venues(id) on delete set null,
  scheduled_at  timestamptz       not null,
  status        match_status_enum not null default 'pending',
  notes         text              check (char_length(notes) <= 500),
  created_by    uuid              not null references profiles(id) on delete cascade,
  created_at    timestamptz       not null default now(),
  updated_at    timestamptz       not null default now(),
  check (player1_id <> player2_id)
);
```

---

### Task 10: Messaging Tables

**Files:**
- Append to: `supabase/migrations/003_social_tables.sql`

Powers Inbox (S20) and Chat (S21) screens. Supabase Realtime listens on `messages`.

- [ ] **Step 1: Append conversations + messages tables**

```sql
-- ─────────────────────────────────────────────
-- CONVERSATIONS
-- Always deduplicated: participant1_id < participant2_id (UUID order).
-- last_message_preview cached here so inbox list avoids joining messages.
-- ─────────────────────────────────────────────
create table if not exists conversations (
  id                    uuid        primary key default gen_random_uuid(),
  participant1_id       uuid        not null references profiles(id) on delete cascade,
  participant2_id       uuid        not null references profiles(id) on delete cascade,
  last_message_at       timestamptz,
  last_message_preview  text,       -- first 100 chars, cached by trigger
  unread_count_p1       int         not null default 0,  -- unread for participant1
  unread_count_p2       int         not null default 0,  -- unread for participant2
  created_at            timestamptz not null default now(),
  unique (participant1_id, participant2_id),
  check (participant1_id < participant2_id)   -- enforce UUID ordering at insert
);

-- ─────────────────────────────────────────────
-- MESSAGES
-- Enable Supabase Realtime on this table for live chat.
-- ─────────────────────────────────────────────
create table if not exists messages (
  id               uuid        primary key default gen_random_uuid(),
  conversation_id  uuid        not null references conversations(id) on delete cascade,
  sender_id        uuid        not null references profiles(id) on delete cascade,
  content          text        not null check (char_length(content) between 1 and 4000),
  is_read          boolean     not null default false,
  created_at       timestamptz not null default now()
);
```

---

### Task 11: Notifications Table

**Files:**
- Append to: `supabase/migrations/003_social_tables.sql`

Powers Notifications screen (S19) with filter chips: All / Matches / Connections / Venues.

- [ ] **Step 1: Append notifications table**

```sql
-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────
create table if not exists notifications (
  id                uuid                  primary key default gen_random_uuid(),
  user_id           uuid                  not null references profiles(id) on delete cascade,
  type              notification_type_enum not null,
  title             text                  not null,
  body              text                  not null,
  data              jsonb                 not null default '{}',
  -- e.g. {"match_id":"uuid","venue_id":"uuid","user_id":"uuid"}
  is_read           boolean               not null default false,

  -- Typed foreign keys for deep linking
  related_user_id   uuid                  references profiles(id) on delete set null,
  related_match_id  uuid                  references matches(id) on delete set null,
  related_venue_id  uuid                  references venues(id) on delete set null,

  created_at        timestamptz           not null default now()
);
```

---

### Task 12: Notification Preferences Table

**Files:**
- Append to: `supabase/migrations/003_social_tables.sql`

Settings screen → Notifications section (toggles per category).

- [ ] **Step 1: Append notification_preferences table**

```sql
-- ─────────────────────────────────────────────
-- NOTIFICATION PREFERENCES
-- 1-1 with profiles. Created with defaults on signup via trigger.
-- ─────────────────────────────────────────────
create table if not exists notification_preferences (
  user_id             uuid    primary key references profiles(id) on delete cascade,
  match_requests      boolean not null default true,
  connection_requests boolean not null default true,
  messages            boolean not null default true,
  community_activity  boolean not null default true,
  venue_updates       boolean not null default true
);
```

---

### Task 13: Activity Feed Table

**Files:**
- Append to: `supabase/migrations/003_social_tables.sql`

Powers HomeFeed (S11) cards: check-ins, connections, matches.

- [ ] **Step 1: Append activity_feed table**

```sql
-- ─────────────────────────────────────────────
-- ACTIVITY FEED
-- Append-only log; HomeFeed queries by friend connections + own events.
-- data JSONB schema per type:
--   checked_in:        {"venue_id","venue_name"}
--   connection_made:   {"other_user_id","other_user_name"}
--   match_played:      {"match_id","opponent_id","opponent_name","venue_name"}
--   venue_added:       {"venue_id","venue_name"}
--   venue_reviewed:    {"venue_id","venue_name","rating"}
--   achievement_earned:{"achievement_code","achievement_name"}
-- ─────────────────────────────────────────────
create table if not exists activity_feed (
  id             uuid               primary key default gen_random_uuid(),
  user_id        uuid               not null references profiles(id) on delete cascade,
  activity_type  activity_type_enum not null,
  data           jsonb              not null default '{}',
  visibility     profile_visibility_enum not null default 'public',
  created_at     timestamptz        not null default now()
);
```

---

### Task 14: Achievements Tables

**Files:**
- Append to: `supabase/migrations/003_social_tables.sql`

MyProfile (S24) achievements grid — earned (colored) vs locked (gray + lock).

- [ ] **Step 1: Append achievements + user_achievements tables**

```sql
-- ─────────────────────────────────────────────
-- ACHIEVEMENTS
-- Static list seeded in migration 006. Admin-only write.
-- ─────────────────────────────────────────────
create table if not exists achievements (
  id          uuid                      primary key default gen_random_uuid(),
  code        text                      unique not null,
  -- e.g. 'first_match', 'venue_explorer'
  name        text                      not null,
  description text                      not null,
  icon_url    text,
  category    achievement_category_enum not null,
  sort_order  int                       not null default 0
);

-- ─────────────────────────────────────────────
-- USER ACHIEVEMENTS
-- Awarded by DB trigger or edge function on qualifying events.
-- ─────────────────────────────────────────────
create table if not exists user_achievements (
  user_id        uuid        not null references profiles(id) on delete cascade,
  achievement_id uuid        not null references achievements(id) on delete cascade,
  earned_at      timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
```

- [ ] **Step 2: Verify all 003 tables**

```sql
select tablename from pg_tables
where schemaname = 'public'
order by tablename;
-- Expected total: 15 tables
-- achievements, activity_feed, connections, conversations, matches,
-- messages, notification_preferences, notifications, profiles,
-- user_achievements, user_availability, user_preferred_venues,
-- user_venue_checkins, venue_photos, venue_reviews, venues
```

---

## Chunk 3: Indexes for Performance

### Task 15: All Indexes

**Files:**
- Create: `supabase/migrations/004_indexes.sql`

Designed around the most expensive query patterns in the app.

- [ ] **Step 1: Create 004_indexes.sql**

```sql
-- supabase/migrations/004_indexes.sql
-- ─────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────

-- Proximity search (PlayerSearch screen: "Players Near You")
create index if not exists profiles_location_gist_idx
  on profiles using gist (location);

-- Skill level filter (PlayerSearch filter chips)
create index if not exists profiles_skill_level_idx
  on profiles (skill_level)
  where setup_complete = true;   -- only show players who completed setup

-- Username lookup (profile URL, username availability check)
create index if not exists profiles_username_idx
  on profiles (lower(username));

-- Array search on playing styles with GIN (future PlayerSearch style filter)
create index if not exists profiles_playing_styles_gin_idx
  on profiles using gin (playing_styles);

-- ─────────────────────────────────────────────
-- VENUES
-- ─────────────────────────────────────────────

-- Proximity search (MapScreen: venues near me)
create index if not exists venues_location_gist_idx
  on venues using gist (location);

-- Only query approved venues (partial index — eliminates pending/rejected)
create index if not exists venues_approved_idx
  on venues (id)
  where status = 'approved';

-- Facility type filter (VenueFilter modal)
create index if not exists venues_facility_type_idx
  on venues (facility_type)
  where status = 'approved';

-- Rating filter (VenueFilter "Show ≥ X stars")
create index if not exists venues_rating_idx
  on venues (average_rating desc)
  where status = 'approved';

-- Amenities GIN (VenueFilter amenities chips)
create index if not exists venues_amenities_gin_idx
  on venues using gin (amenities);

-- ─────────────────────────────────────────────
-- CONNECTIONS
-- ─────────────────────────────────────────────

-- ConnectionsList: find all connections for a user (as either party)
create index if not exists connections_requester_idx
  on connections (requester_id, status);
create index if not exists connections_addressee_idx
  on connections (addressee_id, status);

-- Mutual connections count (PlayerProfile stats)
-- This enables efficient lookup of accepted connections for any user
create index if not exists connections_accepted_idx
  on connections (requester_id, addressee_id)
  where status = 'accepted';

-- ─────────────────────────────────────────────
-- MATCHES
-- ─────────────────────────────────────────────

-- Matches for a player (either side)
create index if not exists matches_player1_idx
  on matches (player1_id, status, scheduled_at desc);
create index if not exists matches_player2_idx
  on matches (player2_id, status, scheduled_at desc);

-- ─────────────────────────────────────────────
-- CONVERSATIONS
-- ─────────────────────────────────────────────

-- Inbox: all conversations for participant1 (sorted by latest message)
create index if not exists conversations_p1_idx
  on conversations (participant1_id, last_message_at desc nulls last);
-- Inbox: all conversations for participant2
create index if not exists conversations_p2_idx
  on conversations (participant2_id, last_message_at desc nulls last);

-- ─────────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────────

-- Chat history: conversation ordered by time
create index if not exists messages_conversation_time_idx
  on messages (conversation_id, created_at asc);

-- Unread count: messages where sender ≠ me + not read
create index if not exists messages_unread_idx
  on messages (conversation_id, is_read)
  where is_read = false;

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────

-- Notifications screen: user's notifications newest first
create index if not exists notifications_user_time_idx
  on notifications (user_id, created_at desc);

-- Unread notification count (bell badge)
create index if not exists notifications_user_unread_idx
  on notifications (user_id, is_read)
  where is_read = false;

-- Filter chips (All/Matches/Connections/Venues)
create index if not exists notifications_user_type_idx
  on notifications (user_id, type, created_at desc);

-- ─────────────────────────────────────────────
-- ACTIVITY FEED
-- ─────────────────────────────────────────────

-- HomeFeed: all activity for a user + friends, newest first
create index if not exists activity_feed_user_time_idx
  on activity_feed (user_id, created_at desc);

-- ─────────────────────────────────────────────
-- VENUE REVIEWS
-- ─────────────────────────────────────────────

-- VenueDetail reviews list
create index if not exists venue_reviews_venue_time_idx
  on venue_reviews (venue_id, created_at desc);

-- ─────────────────────────────────────────────
-- VENUE PHOTOS
-- ─────────────────────────────────────────────

-- Gallery order in VenueDetail
create index if not exists venue_photos_venue_order_idx
  on venue_photos (venue_id, is_primary desc, display_order asc);

-- ─────────────────────────────────────────────
-- CHECK-INS
-- ─────────────────────────────────────────────

-- VenueDetail "Players Here": who's checked into this venue
create index if not exists checkins_venue_idx
  on user_venue_checkins (venue_id, checked_in_at desc);

-- ─────────────────────────────────────────────
-- USER AVAILABILITY
-- ─────────────────────────────────────────────

-- PlayerProfile availability display (all slots for a user)
create index if not exists availability_user_idx
  on user_availability (user_id, day_of_week, time_of_day);
```

- [ ] **Step 2: Verify indexes created**

```sql
select indexname, tablename
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
-- Expected: 25+ indexes across all tables
```

---

## Chunk 4: Row Level Security

### Task 16: Enable RLS and Write All Policies

**Files:**
- Create: `supabase/migrations/005_rls_policies.sql`

Every table must have RLS enabled. Policies are additive (OR logic per operation).

- [ ] **Step 1: Create 005_rls_policies.sql**

```sql
-- supabase/migrations/005_rls_policies.sql
-- Enable RLS on all tables
alter table profiles              enable row level security;
alter table user_availability     enable row level security;
alter table venues                enable row level security;
alter table venue_photos          enable row level security;
alter table venue_reviews         enable row level security;
alter table user_venue_checkins   enable row level security;
alter table user_preferred_venues enable row level security;
alter table connections           enable row level security;
alter table matches               enable row level security;
alter table conversations         enable row level security;
alter table messages              enable row level security;
alter table notifications         enable row level security;
alter table notification_preferences enable row level security;
alter table activity_feed         enable row level security;
alter table achievements          enable row level security;
alter table user_achievements     enable row level security;

-- ─────────────────────────────────────────────
-- HELPER FUNCTION
-- Returns true if two users have an accepted connection.
-- Used in multiple policies.
-- ─────────────────────────────────────────────
create or replace function are_connected(user_a uuid, user_b uuid)
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from connections
    where status = 'accepted'
      and (
        (requester_id = user_a and addressee_id = user_b) or
        (requester_id = user_b and addressee_id = user_a)
      )
  );
$$;

-- ─────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────
create policy "profiles_select_public"
  on profiles for select
  using (
    profile_visibility = 'public'
    or id = auth.uid()
    or are_connected(id, auth.uid())
  );

create policy "profiles_insert_own"
  on profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_own"
  on profiles for update
  using (id = auth.uid());

create policy "profiles_delete_own"
  on profiles for delete
  using (id = auth.uid());

-- ─────────────────────────────────────────────
-- USER AVAILABILITY
-- ─────────────────────────────────────────────
create policy "availability_select"
  on user_availability for select
  using (
    user_id = auth.uid()
    or are_connected(user_id, auth.uid())
  );

create policy "availability_insert_own"
  on user_availability for insert
  with check (user_id = auth.uid());

create policy "availability_update_own"
  on user_availability for update
  using (user_id = auth.uid());

create policy "availability_delete_own"
  on user_availability for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- VENUES (approved venues are public)
-- ─────────────────────────────────────────────
create policy "venues_select_approved"
  on venues for select
  using (status = 'approved' or submitted_by = auth.uid());

create policy "venues_insert_authenticated"
  on venues for insert
  with check (auth.uid() is not null);

create policy "venues_update_own"
  on venues for update
  using (submitted_by = auth.uid());

-- ─────────────────────────────────────────────
-- VENUE PHOTOS
-- ─────────────────────────────────────────────
create policy "venue_photos_select"
  on venue_photos for select
  using (true);  -- public if venue is approved; rely on venue RLS for venue itself

create policy "venue_photos_insert_authenticated"
  on venue_photos for insert
  with check (auth.uid() is not null);

create policy "venue_photos_delete_own"
  on venue_photos for delete
  using (uploaded_by = auth.uid());

-- ─────────────────────────────────────────────
-- VENUE REVIEWS
-- ─────────────────────────────────────────────
create policy "venue_reviews_select"
  on venue_reviews for select
  using (true);

create policy "venue_reviews_insert_authenticated"
  on venue_reviews for insert
  with check (auth.uid() is not null and user_id = auth.uid());

create policy "venue_reviews_update_own"
  on venue_reviews for update
  using (user_id = auth.uid());

create policy "venue_reviews_delete_own"
  on venue_reviews for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- USER VENUE CHECK-INS
-- ─────────────────────────────────────────────
create policy "checkins_select"
  on user_venue_checkins for select
  using (true);  -- anyone can see who's checked in (powers "Players Here")

create policy "checkins_insert_own"
  on user_venue_checkins for insert
  with check (user_id = auth.uid());

create policy "checkins_delete_own"
  on user_venue_checkins for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- USER PREFERRED VENUES
-- ─────────────────────────────────────────────
create policy "preferred_venues_select"
  on user_preferred_venues for select
  using (
    user_id = auth.uid()
    or are_connected(user_id, auth.uid())
  );

create policy "preferred_venues_insert_own"
  on user_preferred_venues for insert
  with check (user_id = auth.uid());

create policy "preferred_venues_delete_own"
  on user_preferred_venues for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- CONNECTIONS
-- ─────────────────────────────────────────────
create policy "connections_select_own"
  on connections for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "connections_insert_authenticated"
  on connections for insert
  with check (auth.uid() is not null and requester_id = auth.uid());

create policy "connections_update_addressee"
  on connections for update
  using (addressee_id = auth.uid() or requester_id = auth.uid());

create policy "connections_delete_own"
  on connections for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ─────────────────────────────────────────────
-- MATCHES
-- ─────────────────────────────────────────────
create policy "matches_select_participants"
  on matches for select
  using (player1_id = auth.uid() or player2_id = auth.uid());

create policy "matches_insert_authenticated"
  on matches for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy "matches_update_participants"
  on matches for update
  using (player1_id = auth.uid() or player2_id = auth.uid());

-- ─────────────────────────────────────────────
-- CONVERSATIONS
-- ─────────────────────────────────────────────
create policy "conversations_select_participants"
  on conversations for select
  using (participant1_id = auth.uid() or participant2_id = auth.uid());

create policy "conversations_insert_authenticated"
  on conversations for insert
  with check (
    auth.uid() is not null
    and (participant1_id = auth.uid() or participant2_id = auth.uid())
    and participant1_id < participant2_id
  );

create policy "conversations_update_participants"
  on conversations for update
  using (participant1_id = auth.uid() or participant2_id = auth.uid());

-- ─────────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────────
create policy "messages_select_participants"
  on messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())
    )
  );

create policy "messages_insert_participants"
  on messages for insert
  with check (
    auth.uid() is not null
    and sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())
    )
  );

create policy "messages_update_own"
  on messages for update
  using (sender_id = auth.uid());

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────
create policy "notifications_select_own"
  on notifications for select
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on notifications for update
  using (user_id = auth.uid());

create policy "notifications_delete_own"
  on notifications for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- NOTIFICATION PREFERENCES
-- ─────────────────────────────────────────────
create policy "notif_prefs_select_own"
  on notification_preferences for select
  using (user_id = auth.uid());

create policy "notif_prefs_insert_own"
  on notification_preferences for insert
  with check (user_id = auth.uid());

create policy "notif_prefs_update_own"
  on notification_preferences for update
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- ACTIVITY FEED
-- ─────────────────────────────────────────────
create policy "activity_feed_select"
  on activity_feed for select
  using (
    user_id = auth.uid()
    or (
      visibility = 'public'
      and are_connected(user_id, auth.uid())
    )
  );

create policy "activity_feed_delete_own"
  on activity_feed for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- ACHIEVEMENTS (public read, no user write)
-- ─────────────────────────────────────────────
create policy "achievements_select"
  on achievements for select
  using (true);

-- ─────────────────────────────────────────────
-- USER ACHIEVEMENTS
-- ─────────────────────────────────────────────
create policy "user_achievements_select"
  on user_achievements for select
  using (true);  -- public (shown on profile)
```

- [ ] **Step 2: Verify RLS enabled and policies created**

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
-- Expected: rowsecurity = true for all tables

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
-- Expected: 40+ policies
```

---

## Chunk 5: Triggers, Functions & Seed Data

### Task 17: Core Database Functions & Triggers

**Files:**
- Create: `supabase/migrations/006_triggers_functions_seed.sql`

- [ ] **Step 1: Create the file with all functions**

```sql
-- supabase/migrations/006_triggers_functions_seed.sql
-- ─────────────────────────────────────────────
-- FUNCTION: update_updated_at_column
-- Generic trigger for all tables with updated_at
-- ─────────────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to all relevant tables
create or replace trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at_column();

create or replace trigger venues_updated_at
  before update on venues
  for each row execute function update_updated_at_column();

create or replace trigger venue_reviews_updated_at
  before update on venue_reviews
  for each row execute function update_updated_at_column();

create or replace trigger connections_updated_at
  before update on connections
  for each row execute function update_updated_at_column();

create or replace trigger matches_updated_at
  before update on matches
  for each row execute function update_updated_at_column();

-- ─────────────────────────────────────────────
-- FUNCTION: sync_profile_location
-- Keeps geography column in sync with lat/lng fields.
-- Fires BEFORE INSERT OR UPDATE on profiles.
-- ─────────────────────────────────────────────
create or replace function sync_profile_location()
returns trigger language plpgsql as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location = st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  else
    new.location = null;
  end if;
  return new;
end;
$$;

create or replace trigger profiles_sync_location
  before insert or update of latitude, longitude on profiles
  for each row execute function sync_profile_location();

-- ─────────────────────────────────────────────
-- FUNCTION: sync_venue_location
-- Same as above for venues table.
-- ─────────────────────────────────────────────
create or replace function sync_venue_location()
returns trigger language plpgsql as $$
begin
  new.location = st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  return new;
end;
$$;

create or replace trigger venues_sync_location
  before insert or update of latitude, longitude on venues
  for each row execute function sync_venue_location();

-- ─────────────────────────────────────────────
-- FUNCTION: handle_new_user
-- Auto-creates profiles row when a new auth user signs up.
-- Also seeds notification_preferences with defaults.
-- ─────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_full_name text;
  v_username  text;
begin
  -- Extract name from metadata (Google Sign-In provides full_name)
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  -- Generate a unique username from email prefix
  v_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '_', 'g'));
  -- Append random suffix to avoid collision
  v_username := v_username || '_' || floor(random() * 9000 + 1000)::text;
  -- Truncate to 30 chars
  v_username := substring(v_username for 30);

  insert into public.profiles (id, full_name, username, avatar_url)
  values (
    new.id,
    v_full_name,
    v_username,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  -- Seed notification preferences
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Hook into Supabase auth
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────
-- FUNCTION: update_venue_rating
-- Recalculates average_rating + review_count after review changes.
-- ─────────────────────────────────────────────
create or replace function update_venue_rating()
returns trigger language plpgsql as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := coalesce(new.venue_id, old.venue_id);

  update venues
  set
    average_rating = (
      select coalesce(round(avg(rating)::numeric, 1)::float4, 0)
      from venue_reviews
      where venue_id = v_venue_id
    ),
    review_count = (
      select count(*) from venue_reviews where venue_id = v_venue_id
    )
  where id = v_venue_id;

  return coalesce(new, old);
end;
$$;

create or replace trigger venue_reviews_update_rating
  after insert or update or delete on venue_reviews
  for each row execute function update_venue_rating();

-- ─────────────────────────────────────────────
-- FUNCTION: update_venue_checkin_count
-- Keeps venues.checkin_count in sync with user_venue_checkins.
-- ─────────────────────────────────────────────
create or replace function update_venue_checkin_count()
returns trigger language plpgsql as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := coalesce(new.venue_id, old.venue_id);
  update venues
  set checkin_count = (
    select count(*) from user_venue_checkins where venue_id = v_venue_id
  )
  where id = v_venue_id;
  return coalesce(new, old);
end;
$$;

create or replace trigger checkins_update_count
  after insert or delete on user_venue_checkins
  for each row execute function update_venue_checkin_count();

-- ─────────────────────────────────────────────
-- FUNCTION: update_conversation_on_message
-- Updates conversations.last_message_at + last_message_preview + unread_count
-- when a new message is inserted.
-- ─────────────────────────────────────────────
create or replace function update_conversation_on_message()
returns trigger language plpgsql as $$
declare
  v_is_p1 boolean;
begin
  -- Determine which participant sent the message (to increment the OTHER one's count)
  select (participant1_id = new.sender_id)
  into v_is_p1
  from conversations
  where id = new.conversation_id;

  update conversations
  set
    last_message_at      = new.created_at,
    last_message_preview = left(new.content, 100),
    unread_count_p1      = case when not v_is_p1 then unread_count_p1 + 1 else unread_count_p1 end,
    unread_count_p2      = case when v_is_p1     then unread_count_p2 + 1 else unread_count_p2 end
  where id = new.conversation_id;

  return new;
end;
$$;

create or replace trigger messages_update_conversation
  after insert on messages
  for each row execute function update_conversation_on_message();

-- ─────────────────────────────────────────────
-- FUNCTION: create_connection_notification
-- Notifies addressee of a new connection request.
-- Notifies requester when request is accepted.
-- ─────────────────────────────────────────────
create or replace function create_connection_notification()
returns trigger language plpgsql security definer as $$
declare
  v_requester_name text;
begin
  select full_name into v_requester_name
  from profiles where id = new.requester_id;

  -- New connection request
  if TG_OP = 'INSERT' then
    insert into notifications (user_id, type, title, body, related_user_id, data)
    values (
      new.addressee_id,
      'connection_request',
      'New Connection Request',
      v_requester_name || ' wants to connect with you',
      new.requester_id,
      jsonb_build_object('connection_id', new.id, 'requester_id', new.requester_id)
    );

  -- Request accepted
  elsif TG_OP = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into notifications (user_id, type, title, body, related_user_id, data)
    values (
      new.requester_id,
      'connection_accepted',
      'Connection Accepted',
      v_requester_name || ' accepted your connection request',
      new.addressee_id,
      jsonb_build_object('connection_id', new.id, 'addressee_id', new.addressee_id)
    );

    -- Add activity feed entry for both users
    insert into activity_feed (user_id, activity_type, data)
    values
      (new.requester_id, 'connection_made', jsonb_build_object('other_user_id', new.addressee_id)),
      (new.addressee_id, 'connection_made', jsonb_build_object('other_user_id', new.requester_id));
  end if;

  return new;
end;
$$;

create or replace trigger connections_notification_trigger
  after insert or update on connections
  for each row execute function create_connection_notification();

-- ─────────────────────────────────────────────
-- FUNCTION: create_match_notification
-- Notifies the other player on match INSERT or status UPDATE.
-- ─────────────────────────────────────────────
create or replace function create_match_notification()
returns trigger language plpgsql security definer as $$
declare
  v_creator_name text;
  v_notify_user  uuid;
  v_notif_type   notification_type_enum;
  v_title        text;
  v_body         text;
begin
  select full_name into v_creator_name
  from profiles where id = new.created_by;

  if TG_OP = 'INSERT' then
    -- Notify the other player of a new match request
    v_notify_user := case when new.created_by = new.player1_id then new.player2_id else new.player1_id end;
    insert into notifications (user_id, type, title, body, related_match_id, data)
    values (
      v_notify_user,
      'match_request',
      'Match Request',
      v_creator_name || ' challenged you to a match',
      new.id,
      jsonb_build_object('match_id', new.id, 'challenger_id', new.created_by)
    );

  elsif TG_OP = 'UPDATE' and old.status <> new.status then
    -- Notify appropriate player of status change
    v_notify_user := case when new.created_by = new.player1_id then new.player1_id else new.player2_id end;

    case new.status
      when 'confirmed' then
        v_notify_user  := new.created_by;   -- notify the challenger
        v_notif_type   := 'match_confirmed';
        v_title        := 'Match Confirmed!';
        v_body         := 'Your match request was accepted';
      when 'cancelled' then
        v_notify_user  := case when auth.uid() = new.player1_id then new.player2_id else new.player1_id end;
        v_notif_type   := 'match_cancelled';
        v_title        := 'Match Cancelled';
        v_body         := v_creator_name || ' cancelled the match';
      else
        return new;
    end case;

    insert into notifications (user_id, type, title, body, related_match_id, data)
    values (v_notify_user, v_notif_type, v_title, v_body, new.id,
            jsonb_build_object('match_id', new.id));
  end if;

  return new;
end;
$$;

create or replace trigger matches_notification_trigger
  after insert or update on matches
  for each row execute function create_match_notification();

-- ─────────────────────────────────────────────
-- FUNCTION: create_checkin_activity
-- Adds activity_feed entry when user checks in to a venue.
-- ─────────────────────────────────────────────
create or replace function create_checkin_activity()
returns trigger language plpgsql as $$
declare
  v_venue_name text;
begin
  select name into v_venue_name from venues where id = new.venue_id;

  insert into activity_feed (user_id, activity_type, data)
  values (
    new.user_id,
    'checked_in',
    jsonb_build_object('venue_id', new.venue_id, 'venue_name', v_venue_name)
  );

  return new;
end;
$$;

create or replace trigger checkins_activity_trigger
  after insert on user_venue_checkins
  for each row execute function create_checkin_activity();

-- ─────────────────────────────────────────────
-- STORAGE BUCKETS
-- Run these in SQL Editor (Supabase handles bucket policies via dashboard or API)
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('venue-photos', 'venue-photos', true),
  ('achievement-icons', 'achievement-icons', true)
on conflict (id) do nothing;

-- Storage RLS policies (Supabase Storage uses its own policy table)
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars auth upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() is not null);

create policy "avatars owner delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and owner = auth.uid()::text);

create policy "venue-photos public read"
  on storage.objects for select
  using (bucket_id = 'venue-photos');

create policy "venue-photos auth upload"
  on storage.objects for insert
  with check (bucket_id = 'venue-photos' and auth.uid() is not null);

create policy "venue-photos owner delete"
  on storage.objects for delete
  using (bucket_id = 'venue-photos' and owner = auth.uid()::text);

create policy "achievement-icons public read"
  on storage.objects for select
  using (bucket_id = 'achievement-icons');

-- ─────────────────────────────────────────────
-- SEED: ACHIEVEMENTS
-- ─────────────────────────────────────────────
insert into achievements (code, name, description, category, sort_order)
values
  ('first_match',       'First Match',        'Schedule your very first match',              'matches',  1),
  ('hat_trick',         'Hat Trick',          'Play 3 matches in a single week',             'matches',  2),
  ('match_veteran',     'Match Veteran',      'Play 10 matches total',                       'matches',  3),
  ('venue_explorer',    'Venue Explorer',     'Check in at 3 different venues',              'venues',   1),
  ('community_builder', 'Community Builder',  'Add a venue that gets approved',              'venues',   2),
  ('reviewer',          'Critic',             'Write reviews for 5 venues',                  'venues',   3),
  ('social_butterfly',  'Social Butterfly',   'Connect with 5 players',                      'social',   1),
  ('networker',         'Networker',          'Connect with 20 players',                     'social',   2),
  ('early_adopter',     'Early Adopter',      'Join PingLink in its first month',            'general',  1),
  ('profile_complete',  'All Set',            'Complete your full player profile setup',     'general',  2)
on conflict (code) do nothing;
```

- [ ] **Step 2: Verify triggers are created**

```sql
select trigger_name, event_object_table, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;
-- Expected: 12+ triggers across tables

select * from achievements order by category, sort_order;
-- Expected: 10 rows
```

- [ ] **Step 3: Verify auto-profile creation works**

In Supabase Auth, create a test user. Then:
```sql
select id, username, full_name, setup_complete from profiles
order by created_at desc limit 5;
-- Expected: new row with auto-generated username

select * from notification_preferences
where user_id = (select id from profiles order by created_at desc limit 1);
-- Expected: 1 row with all defaults true
```

---

## Chunk 6: Supabase Client Integration in React App

### Task 18: Install Supabase & Configure Client

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `.env.local` (gitignored)
- Modify: `.gitignore`

- [ ] **Step 1: Install supabase-js**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Create .env.local**

```bash
# .env.local — never commit this file
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 3: Verify .gitignore has env files**

```bash
# In .gitignore, ensure these lines exist:
.env.local
.env.*.local
```

- [ ] **Step 4: Create src/lib/supabase.ts**

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,  // Capacitor: disable URL-based OAuth redirect detection
  },
});
```

- [ ] **Step 5: Generate TypeScript types from schema**

Run in terminal (requires Supabase CLI installed):
```bash
npx supabase gen types typescript --project-id your-project-id > src/lib/database.types.ts
```

Or use the Supabase dashboard: Project Settings → API → TypeScript Types → copy to `src/lib/database.types.ts`.

- [ ] **Step 6: Verify connection works**

Add a quick test in `src/main.tsx` (remove after verification):
```typescript
import { supabase } from './lib/supabase';
const { data, error } = await supabase.from('achievements').select('code, name');
console.log('Achievements:', data, error);
// Expected: 10 achievement rows, null error
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase.ts supabase/migrations/ .gitignore
git commit -m "feat: add Supabase schema migrations and client setup"
```

---

## Quick Reference: Query Patterns

These are the SQL queries the app will use most. Save as a reference when implementing feature screens.

```typescript
// ─── PlayerSearch: players within radius ───
const { data } = await supabase.rpc('get_players_nearby', {
  lat: userLat,
  lng: userLng,
  radius_km: 10,
  skill: 'intermediate', // optional
});

// Requires this function in Supabase:
// create or replace function get_players_nearby(lat float8, lng float8, radius_km int, skill text default null)
// returns setof profiles language sql stable security definer as $$
//   select * from profiles
//   where setup_complete = true
//     and id <> auth.uid()
//     and show_location = true
//     and st_dwithin(location, st_makepoint(lng, lat)::geography, radius_km * 1000)
//     and (skill is null or skill_level = skill::skill_level_enum)
//   order by st_distance(location, st_makepoint(lng, lat)::geography) asc;
// $$;

// ─── MapScreen: venues within radius ───
const { data } = await supabase.rpc('get_venues_nearby', {
  lat: userLat,
  lng: userLng,
  radius_km: 25,
});

// ─── ConnectionsList: my connections ───
const { data } = await supabase
  .from('connections')
  .select('*, requester:profiles!requester_id(id,username,full_name,avatar_url,skill_level), addressee:profiles!addressee_id(id,username,full_name,avatar_url,skill_level)')
  .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  .eq('status', 'accepted');

// ─── Inbox: conversations sorted by latest ───
const { data } = await supabase
  .from('conversations')
  .select('*, p1:profiles!participant1_id(id,username,full_name,avatar_url,is_online), p2:profiles!participant2_id(id,username,full_name,avatar_url,is_online)')
  .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
  .order('last_message_at', { ascending: false });

// ─── Chat: realtime messages ───
const channel = supabase
  .channel(`conversation:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`,
  }, (payload) => handleNewMessage(payload.new))
  .subscribe();

// ─── Notifications: realtime bell badge ───
const channel = supabase
  .channel(`notifications:${userId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
  }, () => refetchUnreadCount())
  .subscribe();
```

---

## Execution Order

Run migration files in this exact order in Supabase SQL Editor:

1. `001_enums_and_extensions.sql`
2. `002_core_tables.sql`
3. `003_social_tables.sql`
4. `004_indexes.sql`
5. `005_rls_policies.sql`
6. `006_triggers_functions_seed.sql`

Each file is idempotent — safe to re-run if changes are made.

---

## Schema Summary

| Table | Rows expected at launch | Key concern |
|---|---|---|
| `profiles` | 1 per user | PostGIS sync via trigger |
| `user_availability` | 0–28 per user | Multi-select chips |
| `venues` | Crowd-sourced | PostGIS + moderation |
| `venue_photos` | 0–5 per venue | Storage URLs |
| `venue_reviews` | 0–1 per user/venue | Rating trigger |
| `user_venue_checkins` | 0–1 active per user | checkin_count trigger |
| `user_preferred_venues` | 0–N per user | Static list |
| `connections` | O(users²) sparse | Bidirectional queries |
| `matches` | 1v1 only | Status machine |
| `conversations` | 1 per connected pair | UUID ordering constraint |
| `messages` | High volume | Realtime + index |
| `notifications` | High volume | Partial unread index |
| `notification_preferences` | 1 per user | Created on signup |
| `activity_feed` | Append-only | Home feed fan-out |
| `achievements` | 10 fixed | Seeded in migration |
| `user_achievements` | 0–10 per user | Awarded by triggers |
