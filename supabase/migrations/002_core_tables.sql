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

-- ─────────────────────────────────────────────
-- USER AVAILABILITY
-- One row per (user, day, time_slot) — multi-select on Step 4.
-- ─────────────────────────────────────────────
create table if not exists user_availability (
  id           uuid             primary key default gen_random_uuid(),
  user_id      uuid             not null references profiles(id) on delete cascade,
  day_of_week  int              not null check (day_of_week between 0 and 6),
  -- 0 = Monday … 6 = Sunday (matches ProfileSetup chip order)
  time_of_day  time_of_day_enum not null,
  unique (user_id, day_of_week, time_of_day)
);

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
-- Unlike checkins, these persist across sessions.
-- ─────────────────────────────────────────────
create table if not exists user_preferred_venues (
  user_id    uuid        not null references profiles(id) on delete cascade,
  venue_id   uuid        not null references venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);
