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

-- ─────────────────────────────────────────────
-- MATCHES
-- Private 1v1 match between two connected players.
-- created_by = player who initiated (always player1_id)
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

-- ─────────────────────────────────────────────
-- CONVERSATIONS
-- Always deduplicated: participant1_id < participant2_id (UUID lexicographic order).
-- last_message_preview cached here so inbox list avoids joining messages.
-- unread_count_p1/p2 cached here — reset to 0 when user opens the chat.
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
  -- Enforce UUID ordering at insert so dedup is deterministic
  check (participant1_id < participant2_id)
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

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────
create table if not exists notifications (
  id                uuid                   primary key default gen_random_uuid(),
  user_id           uuid                   not null references profiles(id) on delete cascade,
  type              notification_type_enum not null,
  title             text                   not null,
  body              text                   not null,
  data              jsonb                  not null default '{}',
  -- e.g. {"match_id":"uuid","venue_id":"uuid","user_id":"uuid"}
  is_read           boolean                not null default false,

  -- Typed FK columns for deep linking from notification tap
  related_user_id   uuid                   references profiles(id) on delete set null,
  related_match_id  uuid                   references matches(id) on delete set null,
  related_venue_id  uuid                   references venues(id) on delete set null,

  created_at        timestamptz            not null default now()
);

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

-- ─────────────────────────────────────────────
-- ACTIVITY FEED
-- Append-only log; HomeFeed queries by friend connections + own events.
-- data JSONB schema per type:
--   checked_in:         {"venue_id":"uuid","venue_name":"string"}
--   connection_made:    {"other_user_id":"uuid","other_user_name":"string"}
--   match_played:       {"match_id":"uuid","opponent_id":"uuid","opponent_name":"string","venue_name":"string"}
--   venue_added:        {"venue_id":"uuid","venue_name":"string"}
--   venue_reviewed:     {"venue_id":"uuid","venue_name":"string","rating":4}
--   achievement_earned: {"achievement_code":"string","achievement_name":"string"}
-- ─────────────────────────────────────────────
create table if not exists activity_feed (
  id             uuid                    primary key default gen_random_uuid(),
  user_id        uuid                    not null references profiles(id) on delete cascade,
  activity_type  activity_type_enum      not null,
  data           jsonb                   not null default '{}',
  visibility     profile_visibility_enum not null default 'public',
  created_at     timestamptz             not null default now()
);

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
