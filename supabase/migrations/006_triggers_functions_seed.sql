-- supabase/migrations/006_triggers_functions_seed.sql
-- ─────────────────────────────────────────────
-- FUNCTION: update_updated_at_column
-- Generic BEFORE UPDATE trigger to keep updated_at fresh.
-- ─────────────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to all tables with updated_at
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
-- Keeps geography(point) in sync whenever lat/lng fields change.
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
-- Same pattern for venues.
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
-- Fires AFTER INSERT on auth.users.
-- Creates a profiles row + notification_preferences row with safe defaults.
-- ─────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_full_name text;
  v_username  text;
  v_base      text;
begin
  -- Extract display name (Google OAuth provides full_name/name in metadata)
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  -- Build a username from the email prefix, sanitised to allowed chars
  v_base := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '_', 'g'));
  -- Append 4-digit random suffix to avoid collisions
  v_username := substring(v_base for 25) || '_' || floor(random() * 9000 + 1000)::text;

  insert into public.profiles (id, full_name, username, avatar_url)
  values (
    new.id,
    v_full_name,
    v_username,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  -- Seed notification preferences with all defaults = true
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
-- Recalculates average_rating + review_count after any review change.
-- ─────────────────────────────────────────────
create or replace function update_venue_rating()
returns trigger language plpgsql as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := coalesce(new.venue_id, old.venue_id);

  update venues
  set
    average_rating = coalesce((
      select round(avg(rating)::numeric, 1)::float4
      from venue_reviews
      where venue_id = v_venue_id
    ), 0),
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
-- Powers the "Players Here" number on VenueDetail.
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
-- On new message:
--   - Updates last_message_at + last_message_preview (for inbox)
--   - Increments unread_count for the OTHER participant
-- ─────────────────────────────────────────────
create or replace function update_conversation_on_message()
returns trigger language plpgsql as $$
declare
  v_is_p1 boolean;
begin
  -- Which participant sent the message?
  select (participant1_id = new.sender_id)
  into v_is_p1
  from conversations
  where id = new.conversation_id;

  update conversations
  set
    last_message_at      = new.created_at,
    last_message_preview = left(new.content, 100),
    -- Increment the RECIPIENT's unread count, not the sender's
    unread_count_p1 = case
      when not v_is_p1 then unread_count_p1 + 1
      else unread_count_p1
    end,
    unread_count_p2 = case
      when v_is_p1 then unread_count_p2 + 1
      else unread_count_p2
    end
  where id = new.conversation_id;

  return new;
end;
$$;

create or replace trigger messages_update_conversation
  after insert on messages
  for each row execute function update_conversation_on_message();

-- ─────────────────────────────────────────────
-- FUNCTION: create_connection_notification
-- INSERT → notify addressee of request
-- UPDATE (pending→accepted) → notify requester + add activity feed entries
-- ─────────────────────────────────────────────
create or replace function create_connection_notification()
returns trigger language plpgsql security definer as $$
declare
  v_requester_name  text;
  v_addressee_name  text;
begin
  select full_name into v_requester_name from profiles where id = new.requester_id;
  select full_name into v_addressee_name from profiles where id = new.addressee_id;

  if TG_OP = 'INSERT' then
    -- Notify addressee of new request
    insert into notifications (user_id, type, title, body, related_user_id, data)
    values (
      new.addressee_id,
      'connection_request',
      'New Connection Request',
      v_requester_name || ' wants to connect with you',
      new.requester_id,
      jsonb_build_object('connection_id', new.id, 'requester_id', new.requester_id)
    );

  elsif TG_OP = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    -- Notify requester that request was accepted
    insert into notifications (user_id, type, title, body, related_user_id, data)
    values (
      new.requester_id,
      'connection_accepted',
      'Connection Accepted!',
      v_addressee_name || ' accepted your connection request',
      new.addressee_id,
      jsonb_build_object('connection_id', new.id, 'addressee_id', new.addressee_id)
    );

    -- Activity feed: both users get a "connection_made" entry
    insert into activity_feed (user_id, activity_type, data)
    values
      (
        new.requester_id,
        'connection_made',
        jsonb_build_object('other_user_id', new.addressee_id, 'other_user_name', v_addressee_name)
      ),
      (
        new.addressee_id,
        'connection_made',
        jsonb_build_object('other_user_id', new.requester_id, 'other_user_name', v_requester_name)
      );
  end if;

  return new;
end;
$$;

create or replace trigger connections_notification_trigger
  after insert or update on connections
  for each row execute function create_connection_notification();

-- ─────────────────────────────────────────────
-- FUNCTION: create_match_notification
-- INSERT  → notify the challenged player
-- UPDATE (status change) → notify appropriate player
-- ─────────────────────────────────────────────
create or replace function create_match_notification()
returns trigger language plpgsql security definer as $$
declare
  v_creator_name  text;
  v_notify_user   uuid;
begin
  select full_name into v_creator_name from profiles where id = new.created_by;

  if TG_OP = 'INSERT' then
    -- Notify the opponent (whoever is NOT the creator)
    v_notify_user := case
      when new.created_by = new.player1_id then new.player2_id
      else new.player1_id
    end;

    insert into notifications (user_id, type, title, body, related_match_id, data)
    values (
      v_notify_user,
      'match_request',
      'Match Request',
      v_creator_name || ' has challenged you to a match',
      new.id,
      jsonb_build_object('match_id', new.id, 'challenger_id', new.created_by)
    );

  elsif TG_OP = 'UPDATE' and old.status <> new.status then
    case new.status
      when 'confirmed' then
        -- Notify the creator that their request was accepted
        insert into notifications (user_id, type, title, body, related_match_id, data)
        values (
          new.created_by,
          'match_confirmed',
          'Match Confirmed!',
          'Your match request was accepted',
          new.id,
          jsonb_build_object('match_id', new.id)
        );

        -- Activity feed for both players
        insert into activity_feed (user_id, activity_type, data)
        values
          (new.player1_id, 'match_played', jsonb_build_object('match_id', new.id, 'opponent_id', new.player2_id)),
          (new.player2_id, 'match_played', jsonb_build_object('match_id', new.id, 'opponent_id', new.player1_id));

      when 'cancelled' then
        -- Notify the OTHER player that the match was cancelled
        v_notify_user := case
          when new.created_by = new.player1_id then new.player2_id
          else new.player1_id
        end;

        insert into notifications (user_id, type, title, body, related_match_id, data)
        values (
          v_notify_user,
          'match_cancelled',
          'Match Cancelled',
          v_creator_name || ' cancelled the match',
          new.id,
          jsonb_build_object('match_id', new.id)
        );
      else
        null;
    end case;
  end if;

  return new;
end;
$$;

create or replace trigger matches_notification_trigger
  after insert or update on matches
  for each row execute function create_match_notification();

-- ─────────────────────────────────────────────
-- FUNCTION: create_checkin_activity
-- Adds an activity_feed entry when user checks in to a venue.
-- ─────────────────────────────────────────────
create or replace function create_checkin_activity()
returns trigger language plpgsql security definer as $$
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
-- PROXIMITY RPC FUNCTIONS
-- Called from the app via supabase.rpc()
-- ─────────────────────────────────────────────

-- Get players within radius (PlayerSearch screen)
create or replace function get_players_nearby(
  lat       float8,
  lng       float8,
  radius_km int     default 10,
  skill     text    default null
)
returns setof profiles
language sql stable security definer as $$
  select *
  from profiles
  where setup_complete = true
    and id <> auth.uid()
    and show_location = true
    and location is not null
    and st_dwithin(
          location,
          st_setsrid(st_makepoint(lng, lat), 4326)::geography,
          radius_km * 1000
        )
    and (skill is null or skill_level = skill::skill_level_enum)
  order by st_distance(location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) asc;
$$;

-- Get venues within radius (MapScreen)
create or replace function get_venues_nearby(
  lat             float8,
  lng             float8,
  radius_km       int     default 25,
  p_facility_type text    default null,
  p_min_rating    float4  default 0
)
returns table (
  id              uuid,
  name            text,
  address         text,
  latitude        float8,
  longitude       float8,
  facility_type   facility_type_enum,
  amenities       text[],
  average_rating  float4,
  review_count    int,
  checkin_count   int,
  is_verified     boolean,
  opening_hours   jsonb,
  distance_m      float8
)
language sql stable security definer as $$
  select
    v.id, v.name, v.address, v.latitude, v.longitude,
    v.facility_type, v.amenities, v.average_rating, v.review_count,
    v.checkin_count, v.is_verified, v.opening_hours,
    st_distance(v.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_m
  from venues v
  where v.status = 'approved'
    and v.location is not null
    and st_dwithin(
          v.location,
          st_setsrid(st_makepoint(lng, lat), 4326)::geography,
          radius_km * 1000
        )
    and (p_facility_type is null or v.facility_type = p_facility_type::facility_type_enum)
    and v.average_rating >= p_min_rating
  order by distance_m asc;
$$;

-- ─────────────────────────────────────────────
-- STORAGE BUCKETS
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('avatars',           'avatars',           true),
  ('venue-photos',      'venue-photos',       true),
  ('achievement-icons', 'achievement-icons',  true)
on conflict (id) do nothing;

-- Storage object RLS policies
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_auth_upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() is not null);

create policy "avatars_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and owner = auth.uid());

create policy "venue_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'venue-photos');

create policy "venue_photos_auth_upload"
  on storage.objects for insert
  with check (bucket_id = 'venue-photos' and auth.uid() is not null);

create policy "venue_photos_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'venue-photos' and owner = auth.uid());

create policy "achievement_icons_public_read"
  on storage.objects for select
  using (bucket_id = 'achievement-icons');

-- ─────────────────────────────────────────────
-- SEED: ACHIEVEMENTS
-- ─────────────────────────────────────────────
insert into achievements (code, name, description, category, sort_order)
values
  -- Matches
  ('first_match',       'First Match',        'Schedule your very first match',                         'matches',  1),
  ('hat_trick',         'Hat Trick',          'Play 3 matches in a single week',                        'matches',  2),
  ('match_veteran',     'Match Veteran',      'Complete 10 matches',                                    'matches',  3),
  -- Venues
  ('venue_explorer',    'Venue Explorer',     'Check in at 3 different venues',                         'venues',   1),
  ('community_builder', 'Community Builder',  'Add a venue that gets approved',                         'venues',   2),
  ('critic',            'Critic',             'Write reviews for 5 different venues',                   'venues',   3),
  -- Social
  ('social_butterfly',  'Social Butterfly',   'Connect with 5 players',                                 'social',   1),
  ('networker',         'Networker',          'Connect with 20 players',                                'social',   2),
  -- General
  ('profile_complete',  'All Set',            'Complete your full player profile setup',                'general',  1),
  ('early_adopter',     'Early Adopter',      'Among the first players to join PingLink',               'general',  2)
on conflict (code) do nothing;
