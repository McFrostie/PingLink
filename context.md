# PingLink — Master Development Plan

> **Living document.** Update this file after each phase completes.
> Last updated: 2026-02-27 | Status: Phase 1 COMPLETE, Phases 2–8 PLANNED

---

## IMPORTANT NOTE ON TECH STACK


All planning and implementation uses **Flutter** as the frontend framework as this is an android app.
Backend/DB: **Supabase** (PostgreSQL + PostGIS + Realtime + Storage + Auth).

---

## Context

PingLink is a location-based social platform for table tennis players. It solves the problem of fragmented coordination (Facebook groups, WhatsApp chats) by providing unified venue discovery, player matching, and community features.

**Core problems solved:**
1. Players can't easily find nearby venues
2. Players can't find opponents at their skill level
3. No unified scheduling/match-making tool for casual players

---

## Technology Stack (Confirmed)

| Layer | Technology |
|---|---|
| Frontend | Flutter (Dart 3.10.8+) |
| State Management | Riverpod 2.x (riverpod_annotation) |
| Navigation | GoRouter 14.x |
| HTTP Client | Dio 5.x |
| Models | Freezed + JSON Serializable |
| DI | GetIt 8.x |
| Backend/DB | Supabase (PostgreSQL + PostGIS) |
| Auth | Supabase Auth + Google Sign-In |
| Realtime | Supabase Realtime (for messaging) |
| Storage | Supabase Storage (avatars, venue photos) |
| Maps | google_maps_flutter |
| Design System | "Sky Court" (custom theme, Nunito + Plus Jakarta Sans) |

**Packages to ADD (not yet in pubspec.yaml):**
- `supabase_flutter`
- `google_sign_in`
- `google_maps_flutter`
- `geolocator`
- `geocoding`
- `image_picker`
- `cached_network_image`
- `intl` (date formatting)
- `shimmer` (loading skeletons)
- `timeago` (relative timestamps)

---

## Current State (Phase 1 — COMPLETE)

**Built & working:**
- Splash screen (animated logo, tagline, auto-navigate)
- Onboarding carousel (3 slides, progress bar, skip)
- Login screen (glass-morphic design, form validation UI)
- Register screen (glass-morphic design, form validation UI)
- Forgot password screen: NOT YET BUILT
- Design system: "Sky Court" colors, typography, spacing
- Shared widgets: PinglinkButton, PinglinkTextField, EmptyState, PlaceholderScreen
- GoRouter: `/`, `/onboarding`, `/login`, `/register`, `/home` (placeholder)
- Logger, error classes, string extensions, API service (Dio)

**NOT yet built (backend/logic):**
- Supabase auth integration (login/register handlers are stubs)
- Google Sign-In
- Any data layer

**File structure (existing):**
```
lib/
├── app/
│   ├── app.dart
│   ├── routes/app_router.dart
│   └── theme/app_theme.dart
├── core/
│   ├── constants/app_constants.dart
│   ├── errors/failures.dart
│   ├── extensions/string_extensions.dart
│   └── utils/logger.dart
├── features/
│   └── auth/
│       └── presentation/screens/
│           ├── splash_screen.dart
│           ├── onboarding_screen.dart
│           ├── login_screen.dart
│           └── register_screen.dart
├── shared/
│   ├── services/api_service.dart
│   └── widgets/
│       ├── pinglink_button.dart
│       ├── pinglink_text_field.dart
│       ├── placeholder_screen.dart
│       ├── empty_state.dart
│       └── index.dart
└── main.dart
```

---

## Target Architecture (Clean Architecture per Feature)

```
lib/features/{feature}/
├── data/
│   ├── datasources/{feature}_remote_datasource.dart
│   ├── models/{model}.dart  (Freezed + JsonSerializable)
│   └── repositories/{feature}_repository_impl.dart
├── domain/
│   ├── entities/{entity}.dart
│   ├── repositories/{feature}_repository.dart
│   └── usecases/{use_case}.dart
└── presentation/
    ├── providers/{feature}_provider.dart  (Riverpod)
    └── screens/{screen}.dart
```

---

## All 20 Screens — Complete Specification

### Phase 1 (DONE): Auth & Onboarding

#### S1. Splash Screen ✅
- Animated PingLink logo (pulsing rings)
- "PING" white + "LINK" blue wordmark
- Tagline: "Find your game. Find your people."
- Auto-navigate to onboarding after ~3.3s

#### S2. Onboarding Screen ✅
- 3 slides: "FIND YOUR MATCH", "OWN THE COURT", "JOIN THE RALLY"
- Story progress bars, skip button, page indicators
- Final slide → Register

#### S3. Login Screen ✅ (UI only)
- Hero image + glass card
- Email + Password fields
- Forgot Password link, Google Sign-In button
- Navigate to Register

#### S4. Register Screen ✅ (UI only)
- Hero image + glass card
- Full Name, Email, Password fields
- Terms & Privacy links, Google Sign-In button

#### S5. Forgot Password Screen (UI only — NOT YET BUILT)
- Back arrow, title: "Reset Password"
- Subtitle: "Enter your email and we'll send you a reset link"
- Email input
- "Send Reset Link" button
- Success state: checkmark + "Check your inbox"
- Back to Login link

---

### Phase 2: Supabase Backend + Profile Setup Wizard

#### S6. Profile Setup — Step 1: Basic Info
- Progress bar (1/4)
- Profile photo upload circle (tap to pick from gallery/camera)
- Username field (with availability check)
- Date of Birth (date picker)
- City/Location field (text or "Use My Location" button)
- "Continue" button

#### S7. Profile Setup — Step 2: Skill Level
- Progress bar (2/4)
- 5 selectable cards: Beginner / Casual / Intermediate / Advanced / Professional
- Each card: icon + label + 1-line description
- "Continue" disabled until selection

#### S8. Profile Setup — Step 3: Playing Style
- Progress bar (3/4)
- Multi-select chips:
  - Style: Offensive / Defensive / All-Round
  - Grip: Penhold / Shakehand
  - Technique: Heavy Topspin / Chopper / Looper / Blocker
- "Continue" (at least 1 selection required)

#### S9. Profile Setup — Step 4: Availability
- Progress bar (4/4)
- Days: Mon–Sun row chips, multi-select
- Time of Day: 4 cards (Morning 6am–12pm / Afternoon 12pm–5pm / Evening 5pm–9pm / Night 9pm+)
- "Finish Setup" primary button
- "Skip for now" text link

---

### Phase 3: Home Feed + Navigation Shell

#### S10. Main Tab Shell
- Bottom nav: Home / Map / Players / Messages / Profile
- Notification badges on Home and Messages
- Tab persistence (no re-render on tab switch)

#### S11. Home / Activity Feed
- Header: PingLink logo + notification bell
- "Good morning, [Name]" + avatar
- Quick action cards (horizontal scroll): Find Player / Discover Venue / Schedule Match
- "Nearby Activity" section header + "See All"
- Feed cards: avatar + name + timestamp + activity text + tappable tag
- Like/Comment strip (static icons Phase 3, functional later)
- Empty state: illustration + CTA

#### S19. Notifications Screen
- "Notifications" title + "Mark All Read" button
- Filter chips: All / Matches / Connections / Venues
- Cards: type icon + text + timestamp + unread indicator
- Empty state: "You're all caught up!"

---

### Phase 4: Venue Discovery

#### S12. Map Screen
- Full-screen Google Map (~70% height)
- Top search bar overlay + filter icon
- Custom ping pong paddle markers
- Draggable bottom sheet:
  - Collapsed: "Venues Near You" + horizontal scroll cards
  - Card: photo thumbnail + name + distance + star rating + "Open Now"
- FAB (+): "Add a Venue"
- My Location button
- Map style toggle

#### S13. Venue Filter Screen (modal)
- "Filter Venues" title + close X
- Search by name/area
- Distance slider: 1–50km
- Facility Type chips: Club / Sports Center / Community Hall / School / Commercial
- Amenities chips: Parking / Changing Rooms / Equipment Rental / Coaching / Cafeteria
- Rating: 5-star selector (show ≥ X stars)
- Sticky "Apply Filters" button + "Reset" link

#### S14. Venue Detail Screen
- Back + share icons
- Hero image gallery (swipeable, full-width)
- Venue name, address (tappable → maps), distance badge
- Star rating + review count
- Open/Closed status + hours
- Action row: Get Directions / I Play Here (toggle) / Share
- About text
- Amenities chips
- Tables Available (count + type)
- "Players Here": horizontal avatar scroll + "See All"
- Reviews: star breakdown + review cards + "Write a Review"
- Sticky bottom: "Check In" button

#### S15. Add Venue Screen
- Form: Name, Address (+ "Use Map" pin picker), Map preview
- Facility Type dropdown, Number of Tables stepper
- Amenities multi-select chips
- Description textarea (300 char limit)
- Photo upload grid (up to 5)
- Contact info (phone/website, optional)
- Sticky "Submit Venue" button
- Note: "Submitted venues are reviewed before appearing on the map"

---

### Phase 5: Player Discovery & Connections

#### S16. Player Search Screen
- "Find Players" title
- Search input (name/username)
- Filter chips: Nearby / Beginner / Casual / Intermediate / Advanced
- Distance dropdown: 5km / 10km / 25km / 50km
- "Players Near You" + count header
- Player cards: avatar + name + username + skill badge + distance + style chips + "Connect" button
- Empty state

#### S17. Player Public Profile Screen
- Back + more (⋮)
- Cover banner + large avatar overlay
- Name + username + skill badge
- Location text
- Stats row: Connections / Matches Played / Venues Frequented
- Playing style chips
- Availability section (read-only chips)
- Preferred Venues section
- "Send Request" + "Message" action buttons
- Recent activity feed

#### S18. Connections List Screen
- "My Network" title + search icon
- 3 tabs:
  - **Connections**: confirmed list with Message button
  - **Requests**: incoming with Accept/Decline per card
  - **Sent**: outgoing with Cancel option
- Cards: avatar + name + skill chip + mutual count
- Empty states per tab

---

### Phase 6: Messaging

#### S20. Inbox Screen
- "Messages" title + compose icon
- Search bar
- Conversation list: avatar + online dot + name (bold=unread) + last msg preview + timestamp + unread badge
- Empty state

#### S21. Chat Screen
- Header: back + avatar + name (tappable) + video/call (greyed, future)
- Message bubbles: sent (right, primary color) / received (left, gray)
- Timestamps grouped by time
- Read receipts (tick marks)
- System messages (centered): "You're now connected" / "Match scheduled"
- Bottom bar: text input + attachment (disabled Phase 6) + send button

---

### Phase 7: Match Scheduling

#### S22. Match Scheduling Screen
- Step 1 — Opponent: searchable connections list, selected chip
- Step 2 — Venue: "Choose a venue" → venue picker (map/list), selected chip
- Step 3 — Date & Time: week strip calendar + time slot chips
- Step 4 — Notes: optional textarea
- Summary preview card above sticky "Send Match Request"

#### S23. Match Detail Screen
- "Match Details" title + status badge (Pending/Confirmed/Completed)
- Two avatars + "VS" + names
- Venue card (name + address + map thumbnail, tappable)
- Date & Time (large)
- Notes section
- Conditional actions:
  - Pending (recipient): Accept + Decline
  - Confirmed: Get Directions + Cancel Match
  - Completed: Rate Opponent (Phase 9)

---

### Phase 8: Profile Management & Settings

#### S24. My Profile Screen
- "Profile" title + settings gear
- Large avatar + edit overlay
- Name + username + skill badge + style chips + location
- Stats row: Connections / Matches / Venues
- Availability chips (read-only)
- Preferred Venues
- Achievements grid: earned (colored) + locked (gray + lock icon)
  - Badges: "First Match", "Venue Explorer", "Social Butterfly", "Hat Trick"
- Recent activity feed
- "Edit Profile" button

#### S25. Edit Profile Screen
- Back + "Save" (top right)
- Avatar with camera overlay
- All editable fields (scrollable):
  - Full Name, Username, Bio (150 char), Location
  - Skill Level cards, Playing Style chips, Availability
  - Preferred Venues (add/remove)
- Inline field validation
- Unsaved changes warning on back

#### S26. Availability Settings Screen
- "My Availability" title
- Days selector (Mon–Sun, multi-select chips)
- Time of day cards (Morning/Afternoon/Evening/Night with hour ranges)
- "Save Availability" button

#### S27. Settings Screen
- Grouped sections:
  - **Account**: Edit Profile / Change Email / Change Password / Connected Accounts (Google)
  - **Privacy**: Profile Visibility toggle / Show Location toggle / Show Online Status toggle
  - **Notifications**: Match Requests / Connection Requests / Messages / Community Activity (toggles)
  - **App**: Language / Theme (Light/Dark/System) / Clear Cache
  - **Support**: Help Center / Report Bug / Terms / Privacy Policy
  - **Danger Zone**: Log Out (red) / Delete Account (red, with confirmation modal)

---

## Supabase Database Schema

> Full schema saved in `F:\TenisApp\schema.md` — this is the canonical reference.

### Tables Overview

```
auth.users          (Supabase managed)
profiles            (extends auth.users)
user_availability
venues
venue_photos
venue_reviews
user_venue_checkins
connections
matches
conversations
messages
notifications
activity_feed
achievements
user_achievements
```

### Detailed Schema

#### `profiles`
```sql
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  full_name     text not null,
  avatar_url    text,
  bio           text check (char_length(bio) <= 150),
  date_of_birth date,
  city          text,
  latitude      float8,
  longitude     float8,
  skill_level   text check (skill_level in ('beginner','casual','intermediate','advanced','professional')),
  playing_styles text[] default '{}',   -- ['offensive','shakehand','looper']
  is_online     boolean default false,
  last_seen_at  timestamptz,
  profile_visibility text default 'public' check (profile_visibility in ('public','connections_only')),
  show_location boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
-- RLS: users can read public profiles, only own user can update own profile
```

#### `user_availability`
```sql
create table user_availability (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles(id) on delete cascade,
  day_of_week  int check (day_of_week between 0 and 6),  -- 0=Mon, 6=Sun
  time_of_day  text check (time_of_day in ('morning','afternoon','evening','night')),
  unique (user_id, day_of_week, time_of_day)
);
```

#### `venues`
```sql
create table venues (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  address         text not null,
  latitude        float8 not null,
  longitude       float8 not null,
  location        geography(point, 4326),  -- PostGIS for proximity queries
  facility_type   text check (facility_type in ('club','sports_center','community_hall','school','commercial')),
  description     text check (char_length(description) <= 300),
  num_tables      int default 0,
  amenities       text[] default '{}',     -- ['parking','coaching','equipment_rental']
  contact_phone   text,
  contact_website text,
  submitted_by    uuid references profiles(id),
  status          text default 'pending' check (status in ('pending','approved','rejected')),
  is_verified     boolean default false,
  opening_hours   jsonb,                   -- { mon: {open:"09:00", close:"22:00"}, ... }
  average_rating  float4 default 0,
  review_count    int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
-- Index for proximity queries:
create index venues_location_idx on venues using gist (location);
```

#### `venue_photos`
```sql
create table venue_photos (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid references venues(id) on delete cascade,
  url         text not null,              -- Supabase Storage URL
  is_primary  boolean default false,
  uploaded_by uuid references profiles(id),
  created_at  timestamptz default now()
);
```

#### `venue_reviews`
```sql
create table venue_reviews (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid references venues(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  rating     int check (rating between 1 and 5),
  comment    text,
  created_at timestamptz default now(),
  unique (venue_id, user_id)              -- one review per user per venue
);
```

#### `user_venue_checkins`
```sql
create table user_venue_checkins (
  user_id    uuid references profiles(id) on delete cascade,
  venue_id   uuid references venues(id) on delete cascade,
  checked_in_at timestamptz default now(),
  primary key (user_id, venue_id)         -- current check-in (one active at a time)
);
-- For "I Play Here" and "Players Here" feature
```

#### `connections`
```sql
create table connections (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid references profiles(id) on delete cascade,
  addressee_id  uuid references profiles(id) on delete cascade,
  status        text default 'pending' check (status in ('pending','accepted','rejected','blocked')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (requester_id, addressee_id)
);
-- Index for fast lookup by either party:
create index connections_addressee_idx on connections (addressee_id);
```

#### `matches`
```sql
create table matches (
  id           uuid primary key default gen_random_uuid(),
  player1_id   uuid references profiles(id) on delete cascade,
  player2_id   uuid references profiles(id) on delete cascade,
  venue_id     uuid references venues(id),
  scheduled_at timestamptz not null,
  status       text default 'pending' check (status in ('pending','confirmed','cancelled','completed')),
  notes        text,
  created_by   uuid references profiles(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
```

#### `conversations`
```sql
create table conversations (
  id               uuid primary key default gen_random_uuid(),
  participant1_id  uuid references profiles(id) on delete cascade,
  participant2_id  uuid references profiles(id) on delete cascade,
  last_message_at  timestamptz,
  created_at       timestamptz default now(),
  unique (participant1_id, participant2_id)
);
-- Note: always store smaller UUID as participant1_id for dedup
```

#### `messages`
```sql
create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references conversations(id) on delete cascade,
  sender_id        uuid references profiles(id) on delete cascade,
  content          text not null,
  is_read          boolean default false,
  created_at       timestamptz default now()
);
-- Enable Supabase Realtime on this table for live chat
create index messages_conversation_idx on messages (conversation_id, created_at desc);
```

#### `notifications`
```sql
create table notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references profiles(id) on delete cascade,
  type              text check (type in (
                      'connection_request','connection_accepted',
                      'match_request','match_confirmed','match_cancelled',
                      'message','venue_approved','achievement_earned'
                    )),
  title             text not null,
  body              text not null,
  data              jsonb default '{}',     -- extra metadata (ids, etc.)
  is_read           boolean default false,
  related_user_id   uuid references profiles(id),
  related_match_id  uuid references matches(id),
  related_venue_id  uuid references venues(id),
  created_at        timestamptz default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);
```

#### `activity_feed`
```sql
create table activity_feed (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles(id) on delete cascade,
  activity_type text check (activity_type in (
                  'match_played','venue_added','connection_made',
                  'achievement_earned','venue_reviewed','checked_in'
                )),
  data          jsonb default '{}',   -- { venue_id, venue_name, player_id, etc. }
  visibility    text default 'public' check (visibility in ('public','connections_only')),
  created_at    timestamptz default now()
);
create index activity_feed_user_idx on activity_feed (user_id, created_at desc);
```

#### `achievements`
```sql
create table achievements (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,   -- 'first_match', 'venue_explorer', etc.
  name        text not null,
  description text,
  icon_url    text,
  category    text check (category in ('social','venues','matches','general'))
);

-- Seed data:
-- 'first_match'        → "First Match" — Schedule your first match
-- 'venue_explorer'     → "Venue Explorer" — Check in at 3 different venues
-- 'social_butterfly'   → "Social Butterfly" — Connect with 5 players
-- 'hat_trick'          → "Hat Trick" — Play 3 matches in a week
-- 'community_builder'  → "Community Builder" — Add a verified venue
```

#### `user_achievements`
```sql
create table user_achievements (
  user_id        uuid references profiles(id) on delete cascade,
  achievement_id uuid references achievements(id) on delete cascade,
  earned_at      timestamptz default now(),
  primary key (user_id, achievement_id)
);
```

### Row Level Security (RLS) Summary

| Table | Read | Insert | Update | Delete |
|---|---|---|---|---|
| profiles | Public (if visible) / Own | Own only | Own only | Own only |
| user_availability | Connection or own | Own only | Own only | Own only |
| venues | All (approved) | Authenticated | Own / Admin | Own / Admin |
| venue_photos | All | Authenticated | Own | Own |
| venue_reviews | All | Authenticated (1/venue) | Own | Own |
| user_venue_checkins | All | Authenticated | — | Own |
| connections | Own rows | Authenticated | Own rows | Own rows |
| matches | Participants only | Authenticated | Participants | Participants |
| conversations | Participants only | Authenticated | Participants | — |
| messages | Conversation participants | Authenticated | — | Own |
| notifications | Own only | System/DB triggers | Own (is_read) | Own |
| activity_feed | Friends/public | System | — | Own |
| achievements | All | Admin only | Admin only | Admin only |
| user_achievements | All | System triggers | — | — |

### Supabase Storage Buckets

| Bucket | Access | Notes |
|---|---|---|
| `avatars` | Public read, auth write | Profile photos |
| `venue-photos` | Public read, auth write | Venue images (up to 5/venue) |
| `achievement-icons` | Public read, admin write | Badge icons |

### Supabase Functions (Database Triggers)

1. **`handle_new_user`** — on `auth.users` INSERT → create `profiles` row
2. **`update_venue_rating`** — on `venue_reviews` INSERT/UPDATE/DELETE → recalculate `venues.average_rating`
3. **`create_connection_notification`** — on `connections` INSERT → notify addressee
4. **`create_match_notification`** — on `matches` INSERT/UPDATE → notify relevant player
5. **`award_achievements`** — on various events → check achievement criteria, insert into `user_achievements`
6. **`update_timestamps`** — generic trigger for `updated_at` columns

---

## Development Phases

### Phase 1 — Auth & Onboarding [COMPLETE]
**Screens:** S1 Splash, S2 Onboarding, S3 Login, S4 Register
**Backend:** None
**Status:** UI complete, backend stubs only

### Phase 2 — Supabase Backend + Profile Setup [NEXT]
**Screens:** S5 Forgot Password, S6–S9 Profile Setup Wizard
**Backend:**
- Supabase project setup (keys in `.env`)
- `supabase_flutter` initialization in `main.dart`
- Auth: real login, register, Google Sign-In, forgot password
- Profile creation flow on first login
- Tables: `profiles`, `user_availability`
- Storage bucket: `avatars`
- Trigger: `handle_new_user`
**New feature folders:** `features/auth/`, `features/profile/`
**Key files to create:**
- `lib/core/supabase/supabase_client.dart`
- `lib/features/auth/data/` (datasource, repo impl)
- `lib/features/auth/domain/` (usecases: login, register, logout, resetPassword)
- `lib/features/profile/data/`, `domain/`

### Phase 3 — Home Feed + Tab Shell [AFTER PHASE 2]
**Screens:** S10 Tab Shell, S11 Home Feed, S19 Notifications
**Backend:**
- Tables: `activity_feed`, `notifications`
- Realtime subscription on notifications
**New folders:** `features/home/`, `features/notifications/`

### Phase 4 — Venue Discovery [AFTER PHASE 3]
**Screens:** S12 Map, S13 Venue Filter, S14 Venue Detail, S15 Add Venue
**Backend:**
- Tables: `venues`, `venue_photos`, `venue_reviews`, `user_venue_checkins`
- PostGIS proximity queries (ST_DWithin)
- Storage bucket: `venue-photos`
- Trigger: `update_venue_rating`
- Google Maps API key setup
**New folders:** `features/venues/`

### Phase 5 — Player Discovery & Connections [AFTER PHASE 4]
**Screens:** S16 Player Search, S17 Player Public Profile, S18 Connections List
**Backend:**
- Tables: `connections`
- Proximity queries on `profiles.location`
- Trigger: `create_connection_notification`
**New folders:** `features/players/`, `features/connections/`

### Phase 6 — Messaging [AFTER PHASE 5]
**Screens:** S20 Inbox, S21 Chat
**Backend:**
- Tables: `conversations`, `messages`
- Supabase Realtime on `messages` table
- Presence for online status
**New folders:** `features/messaging/`

### Phase 7 — Match Scheduling [AFTER PHASE 5]
**Screens:** S22 Match Scheduling, S23 Match Detail
**Backend:**
- Table: `matches`
- Trigger: `create_match_notification`
**New folders:** `features/matches/`

### Phase 8 — Profile Management + Settings [AFTER PHASE 2]
**Screens:** S24 My Profile, S25 Edit Profile, S26 Availability Settings, S27 Settings
**Backend:**
- Tables: `achievements`, `user_achievements`
- Trigger: `award_achievements`
- All settings toggles (RLS policy updates)
**New folders:** `features/settings/`, expand `features/profile/`

---

## Phase Dependency Graph

```
Phase 1 (Auth UI) ──► Phase 2 (Supabase + Profile)
                              │
                  ┌───────────┤
                  ▼           ▼
            Phase 3        Phase 8
          (Home Feed)   (Profile Mgmt)
                  │
                  ▼
            Phase 4 (Venues)
                  │
                  ▼
            Phase 5 (Players/Connections)
                  │
            ┌─────┴──────┐
            ▼            ▼
        Phase 6       Phase 7
      (Messaging)    (Matches)
```

---

## Router Map (Final State)

```
/                   → SplashScreen
/onboarding         → OnboardingScreen
/login              → LoginScreen
/register           → RegisterScreen
/forgot-password    → ForgotPasswordScreen
/setup/basic        → ProfileSetupStep1Screen
/setup/skill        → ProfileSetupStep2Screen
/setup/style        → ProfileSetupStep3Screen
/setup/availability → ProfileSetupStep4Screen

/home               → HomeScreen (tab shell entry)
/home/notifications → NotificationsScreen

/map                → MapScreen
/map/filter         → VenueFilterScreen (modal)
/map/venue/:id      → VenueDetailScreen
/map/add-venue      → AddVenueScreen

/players            → PlayerSearchScreen
/players/:id        → PlayerPublicProfileScreen

/connections        → ConnectionsListScreen
/connections/match/schedule   → MatchSchedulingScreen
/connections/match/:id        → MatchDetailScreen

/messages           → InboxScreen
/messages/:conversationId     → ChatScreen

/profile            → MyProfileScreen
/profile/edit       → EditProfileScreen
/profile/availability → AvailabilitySettingsScreen
/profile/settings   → SettingsScreen
```

---

## File Naming Conventions

- Screens: `snake_case_screen.dart`
- Providers: `snake_case_provider.dart`
- Models: `snake_case_model.dart` (Freezed)
- Entities: `snake_case.dart`
- Datasources: `snake_case_remote_datasource.dart`
- Repos: `snake_case_repository.dart` (abstract), `snake_case_repository_impl.dart`
- Usecases: `verb_noun.dart` (e.g., `login_user.dart`, `get_nearby_venues.dart`)

---

## Environment Variables Required

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
GOOGLE_MAPS_API_KEY_ANDROID=AIzaxxx
GOOGLE_MAPS_API_KEY_IOS=AIzaxxx
GOOGLE_WEB_CLIENT_ID=xxx.apps.googleusercontent.com
```

---

## Design System Reference

**Colors (Sky Court theme):**
- Primary Blue: `#1E72FF`
- Lime Accent: `#B4F060`
- Background Dark: `#07090F` → `#0C1428`
- Text Dark: `#0A1A3E` | Mid: `#4B6496` | Light: `#90A8CE`
- Surface: `#FFFFFF` | Card Border: `#D0E4FF`

**Typography:**
- Display: Nunito (800–900 weight)
- UI: Plus Jakarta Sans (400–700)
- Elegant headings: Playfair Display (italic)

**Reusable widgets (already exist):**
- `PinglinkButton` — primary/secondary/text/outline variants + loading state
- `PinglinkTextField` — light/dark, label-above style
- `EmptyState` — icon + message + optional action
- `PlaceholderScreen` — "coming soon" placeholder


## What To Do Each Session

1. Read `F:\TenisApp\plans\PLAN.md` first
2. Check current phase status in the Screens Status Tracker
3. Build the identified screens/backend for that phase
4. Update phase status when complete
5. Move to next phase

---

## Screens Status Tracker

| # | Screen | Phase | Status |
|---|--------|-------|--------|
| S1 | Splash | 1 | ✅ Complete |
| S2 | Onboarding | 1 | ✅ Complete |
| S3 | Login | 1 | ✅ UI done, backend needed |
| S4 | Register | 1 | ✅ UI done, backend needed |
| S5 | Forgot Password | 2 | ✅ UI done, backend needed |
| S6 | Profile Setup Step 1 | 2 | ✅ UI done, backend needed |
| S7 | Profile Setup Step 2 | 2 | ✅ UI done, backend needed |
| S8 | Profile Setup Step 3 | 2 | ✅ UI done, backend needed |
| S9 | Profile Setup Step 4 | 2 | ✅ UI done, backend needed |
| S10 | Main Tab Shell | 3 | ⬜ Not started |
| S11 | Home/Activity Feed | 3 | ⬜ Not started |
| S12 | Map Screen | 4 | ⬜ Not started |
| S13 | Venue Filter | 4 | ⬜ Not started |
| S14 | Venue Detail | 4 | ⬜ Not started |
| S15 | Add Venue | 4 | ⬜ Not started |
| S16 | Player Search | 5 | ⬜ Not started |
| S17 | Player Public Profile | 5 | ⬜ Not started |
| S18 | Connections List | 5 | ⬜ Not started |
| S19 | Notifications | 3 | ⬜ Not started |
| S20 | Inbox | 6 | ⬜ Not started |
| S21 | Chat | 6 | ⬜ Not started |
| S22 | Match Scheduling | 7 | ⬜ Not started |
| S23 | Match Detail | 7 | ⬜ Not started |
| S24 | My Profile | 8 | ⬜ Not started |
| S25 | Edit Profile | 8 | ⬜ Not started |
| S26 | Availability Settings | 8 | ⬜ Not started |
| S27 | Settings | 8 | ⬜ Not started |
