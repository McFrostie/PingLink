-- supabase/migrations/005_rls_policies.sql
-- Enable RLS on every table
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
-- Used in multiple policies below. security definer bypasses RLS on connections.
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
drop policy if exists "profiles_select_public" on profiles;
create policy "profiles_select_public"
  on profiles for select
  using (
    profile_visibility = 'public'
    or id = auth.uid()
    or are_connected(id, auth.uid())
  );

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own"
  on profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own"
  on profiles for update
  using (id = auth.uid());

drop policy if exists "profiles_delete_own" on profiles;
create policy "profiles_delete_own"
  on profiles for delete
  using (id = auth.uid());

-- ─────────────────────────────────────────────
-- USER AVAILABILITY
-- ─────────────────────────────────────────────
drop policy if exists "availability_select" on user_availability;
create policy "availability_select"
  on user_availability for select
  using (
    user_id = auth.uid()
    or are_connected(user_id, auth.uid())
  );

drop policy if exists "availability_insert_own" on user_availability;
create policy "availability_insert_own"
  on user_availability for insert
  with check (user_id = auth.uid());

drop policy if exists "availability_update_own" on user_availability;
create policy "availability_update_own"
  on user_availability for update
  using (user_id = auth.uid());

drop policy if exists "availability_delete_own" on user_availability;
create policy "availability_delete_own"
  on user_availability for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- VENUES (approved venues are public)
-- ─────────────────────────────────────────────
drop policy if exists "venues_select_approved" on venues;
create policy "venues_select_approved"
  on venues for select
  using (status = 'approved' or submitted_by = auth.uid());

drop policy if exists "venues_insert_authenticated" on venues;
create policy "venues_insert_authenticated"
  on venues for insert
  with check (auth.uid() is not null);

drop policy if exists "venues_update_own" on venues;
create policy "venues_update_own"
  on venues for update
  using (submitted_by = auth.uid());

-- ─────────────────────────────────────────────
-- VENUE PHOTOS
-- ─────────────────────────────────────────────
drop policy if exists "venue_photos_select" on venue_photos;
create policy "venue_photos_select"
  on venue_photos for select
  using (true);

drop policy if exists "venue_photos_insert_authenticated" on venue_photos;
create policy "venue_photos_insert_authenticated"
  on venue_photos for insert
  with check (auth.uid() is not null);

drop policy if exists "venue_photos_delete_own" on venue_photos;
create policy "venue_photos_delete_own"
  on venue_photos for delete
  using (uploaded_by = auth.uid());

-- ─────────────────────────────────────────────
-- VENUE REVIEWS
-- ─────────────────────────────────────────────
drop policy if exists "venue_reviews_select" on venue_reviews;
create policy "venue_reviews_select"
  on venue_reviews for select
  using (true);

drop policy if exists "venue_reviews_insert_authenticated" on venue_reviews;
create policy "venue_reviews_insert_authenticated"
  on venue_reviews for insert
  with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "venue_reviews_update_own" on venue_reviews;
create policy "venue_reviews_update_own"
  on venue_reviews for update
  using (user_id = auth.uid());

drop policy if exists "venue_reviews_delete_own" on venue_reviews;
create policy "venue_reviews_delete_own"
  on venue_reviews for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- USER VENUE CHECK-INS
-- ─────────────────────────────────────────────
drop policy if exists "checkins_select" on user_venue_checkins;
create policy "checkins_select"
  on user_venue_checkins for select
  using (true);  -- public: powers "Players Here" list

drop policy if exists "checkins_insert_own" on user_venue_checkins;
create policy "checkins_insert_own"
  on user_venue_checkins for insert
  with check (user_id = auth.uid());

drop policy if exists "checkins_delete_own" on user_venue_checkins;
create policy "checkins_delete_own"
  on user_venue_checkins for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- USER PREFERRED VENUES
-- ─────────────────────────────────────────────
drop policy if exists "preferred_venues_select" on user_preferred_venues;
create policy "preferred_venues_select"
  on user_preferred_venues for select
  using (
    user_id = auth.uid()
    or are_connected(user_id, auth.uid())
  );

drop policy if exists "preferred_venues_insert_own" on user_preferred_venues;
create policy "preferred_venues_insert_own"
  on user_preferred_venues for insert
  with check (user_id = auth.uid());

drop policy if exists "preferred_venues_delete_own" on user_preferred_venues;
create policy "preferred_venues_delete_own"
  on user_preferred_venues for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- CONNECTIONS
-- ─────────────────────────────────────────────
drop policy if exists "connections_select_own" on connections;
create policy "connections_select_own"
  on connections for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "connections_insert_authenticated" on connections;
create policy "connections_insert_authenticated"
  on connections for insert
  with check (auth.uid() is not null and requester_id = auth.uid());

drop policy if exists "connections_update_participants" on connections;
create policy "connections_update_participants"
  on connections for update
  using (addressee_id = auth.uid() or requester_id = auth.uid());

drop policy if exists "connections_delete_own" on connections;
create policy "connections_delete_own"
  on connections for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ─────────────────────────────────────────────
-- MATCHES
-- ─────────────────────────────────────────────
drop policy if exists "matches_select_participants" on matches;
create policy "matches_select_participants"
  on matches for select
  using (player1_id = auth.uid() or player2_id = auth.uid());

drop policy if exists "matches_insert_authenticated" on matches;
create policy "matches_insert_authenticated"
  on matches for insert
  with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists "matches_update_participants" on matches;
create policy "matches_update_participants"
  on matches for update
  using (player1_id = auth.uid() or player2_id = auth.uid());

-- ─────────────────────────────────────────────
-- CONVERSATIONS
-- ─────────────────────────────────────────────
drop policy if exists "conversations_select_participants" on conversations;
create policy "conversations_select_participants"
  on conversations for select
  using (participant1_id = auth.uid() or participant2_id = auth.uid());

drop policy if exists "conversations_insert_authenticated" on conversations;
create policy "conversations_insert_authenticated"
  on conversations for insert
  with check (
    auth.uid() is not null
    and (participant1_id = auth.uid() or participant2_id = auth.uid())
    and participant1_id < participant2_id
  );

drop policy if exists "conversations_update_participants" on conversations;
create policy "conversations_update_participants"
  on conversations for update
  using (participant1_id = auth.uid() or participant2_id = auth.uid());

-- ─────────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────────
drop policy if exists "messages_select_participants" on messages;
create policy "messages_select_participants"
  on messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.participant1_id = auth.uid() or c.participant2_id = auth.uid())
    )
  );

drop policy if exists "messages_insert_participants" on messages;
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

drop policy if exists "messages_update_own" on messages;
create policy "messages_update_own"
  on messages for update
  using (sender_id = auth.uid());

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────
drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own"
  on notifications for select
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own"
  on notifications for update
  using (user_id = auth.uid());

drop policy if exists "notifications_delete_own" on notifications;
create policy "notifications_delete_own"
  on notifications for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- NOTIFICATION PREFERENCES
-- ─────────────────────────────────────────────
drop policy if exists "notif_prefs_select_own" on notification_preferences;
create policy "notif_prefs_select_own"
  on notification_preferences for select
  using (user_id = auth.uid());

drop policy if exists "notif_prefs_insert_own" on notification_preferences;
create policy "notif_prefs_insert_own"
  on notification_preferences for insert
  with check (user_id = auth.uid());

drop policy if exists "notif_prefs_update_own" on notification_preferences;
create policy "notif_prefs_update_own"
  on notification_preferences for update
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- ACTIVITY FEED
-- ─────────────────────────────────────────────
drop policy if exists "activity_feed_select" on activity_feed;
create policy "activity_feed_select"
  on activity_feed for select
  using (
    user_id = auth.uid()
    or (
      visibility = 'public'
      and are_connected(user_id, auth.uid())
    )
  );

drop policy if exists "activity_feed_delete_own" on activity_feed;
create policy "activity_feed_delete_own"
  on activity_feed for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- ACHIEVEMENTS (public read, no user write path)
-- ─────────────────────────────────────────────
drop policy if exists "achievements_select" on achievements;
create policy "achievements_select"
  on achievements for select
  using (true);

-- ─────────────────────────────────────────────
-- USER ACHIEVEMENTS (public read — shown on profiles)
-- ─────────────────────────────────────────────
drop policy if exists "user_achievements_select" on user_achievements;
create policy "user_achievements_select"
  on user_achievements for select
  using (true);
