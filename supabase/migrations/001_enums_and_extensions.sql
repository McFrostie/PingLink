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
