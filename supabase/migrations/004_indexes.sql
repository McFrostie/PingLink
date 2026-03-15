-- supabase/migrations/004_indexes.sql
-- All performance indexes. Designed around the most expensive query patterns.

-- ─────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────

-- Proximity search (PlayerSearch: "Players Near You")
create index if not exists profiles_location_gist_idx
  on profiles using gist (location);

-- Skill level filter chip (PlayerSearch + only show completed profiles)
create index if not exists profiles_skill_level_idx
  on profiles (skill_level)
  where setup_complete = true;

-- Username lookup (profile URL, username availability check during setup)
create index if not exists profiles_username_lower_idx
  on profiles (lower(username));

-- Array search on playing styles with GIN (future style-based filtering)
create index if not exists profiles_playing_styles_gin_idx
  on profiles using gin (playing_styles);

-- ─────────────────────────────────────────────
-- VENUES
-- ─────────────────────────────────────────────

-- Proximity search (MapScreen: "Venues Near You")
create index if not exists venues_location_gist_idx
  on venues using gist (location);

-- Partial index: only approved venues are ever queried by users
create index if not exists venues_approved_name_idx
  on venues (name)
  where status = 'approved';

-- Facility type filter (VenueFilter modal chips)
create index if not exists venues_facility_type_idx
  on venues (facility_type)
  where status = 'approved';

-- Rating filter (VenueFilter "Show ≥ X stars")
create index if not exists venues_rating_desc_idx
  on venues (average_rating desc)
  where status = 'approved';

-- Amenities GIN (VenueFilter amenities multi-select)
create index if not exists venues_amenities_gin_idx
  on venues using gin (amenities);

-- ─────────────────────────────────────────────
-- CONNECTIONS
-- ─────────────────────────────────────────────

-- ConnectionsList: outgoing requests (Sent tab)
create index if not exists connections_requester_status_idx
  on connections (requester_id, status);

-- ConnectionsList: incoming requests (Requests tab)
create index if not exists connections_addressee_status_idx
  on connections (addressee_id, status);

-- Mutual connections count (PlayerProfile stats)
create index if not exists connections_accepted_idx
  on connections (requester_id, addressee_id)
  where status = 'accepted';

-- ─────────────────────────────────────────────
-- MATCHES
-- ─────────────────────────────────────────────

-- Match history for player (either side), sorted by date
create index if not exists matches_player1_idx
  on matches (player1_id, status, scheduled_at desc);

create index if not exists matches_player2_idx
  on matches (player2_id, status, scheduled_at desc);

-- ─────────────────────────────────────────────
-- CONVERSATIONS
-- ─────────────────────────────────────────────

-- Inbox: conversations for participant1 sorted by latest message
create index if not exists conversations_p1_time_idx
  on conversations (participant1_id, last_message_at desc nulls last);

-- Inbox: conversations for participant2 sorted by latest message
create index if not exists conversations_p2_time_idx
  on conversations (participant2_id, last_message_at desc nulls last);

-- ─────────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────────

-- Chat history: messages in a conversation in chronological order
create index if not exists messages_conversation_time_idx
  on messages (conversation_id, created_at asc);

-- Unread badge: messages not yet read by recipient
create index if not exists messages_unread_idx
  on messages (conversation_id, is_read)
  where is_read = false;

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────

-- Notifications screen: user's list, newest first
create index if not exists notifications_user_time_idx
  on notifications (user_id, created_at desc);

-- Bell badge: unread count only
create index if not exists notifications_user_unread_idx
  on notifications (user_id)
  where is_read = false;

-- Filter chips: All / Matches / Connections / Venues
create index if not exists notifications_user_type_idx
  on notifications (user_id, type, created_at desc);

-- ─────────────────────────────────────────────
-- ACTIVITY FEED
-- ─────────────────────────────────────────────

-- HomeFeed: all activity for a user + their connections, newest first
create index if not exists activity_feed_user_time_idx
  on activity_feed (user_id, created_at desc);

-- ─────────────────────────────────────────────
-- VENUE REVIEWS
-- ─────────────────────────────────────────────

-- VenueDetail reviews section, newest first
create index if not exists venue_reviews_venue_time_idx
  on venue_reviews (venue_id, created_at desc);

-- ─────────────────────────────────────────────
-- VENUE PHOTOS
-- ─────────────────────────────────────────────

-- Gallery order: primary photo first, then by display_order
create index if not exists venue_photos_gallery_idx
  on venue_photos (venue_id, is_primary desc, display_order asc);

-- ─────────────────────────────────────────────
-- USER VENUE CHECK-INS
-- ─────────────────────────────────────────────

-- VenueDetail "Players Here": who's currently checked in
create index if not exists checkins_venue_time_idx
  on user_venue_checkins (venue_id, checked_in_at desc);

-- ─────────────────────────────────────────────
-- USER AVAILABILITY
-- ─────────────────────────────────────────────

-- PlayerProfile availability display + AvailabilitySettings
create index if not exists availability_user_idx
  on user_availability (user_id, day_of_week, time_of_day);
