// src/lib/queries/feed.ts
// All queries use the exact column names from the Supabase migrations.
import { supabase } from '../supabase';

// ─── Activity Feed ──────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  activity_type: string;
  // JSONB data fields — shape depends on activity_type:
  // checked_in:       { venue_id, venue_name }
  // connection_made:  { other_user_id, other_user_name }
  // match_played:     { match_id, opponent_id, opponent_name, venue_name }
  // venue_added:      { venue_id, venue_name }
  // venue_reviewed:   { venue_id, venue_name, rating }
  // achievement_earned: { achievement_code, achievement_name }
  data: Record<string, unknown>;
  created_at: string;
}

/**
 * Resolve the list of user IDs the current user is connected to (including themselves).
 * Pass the result to fetchActivityFeed / fetchConnectionCheckins to avoid duplicate lookups.
 */
export async function resolveConnectedIds(userId: string): Promise<string[]> {
  const { data: connData } = await supabase
    .from('connections')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted');

  const ids: string[] = [userId];
  if (connData) {
    for (const row of connData) {
      const otherId = row.requester_id === userId ? row.addressee_id : row.requester_id;
      ids.push(otherId);
    }
  }
  return ids;
}

/**
 * Fetch activity feed entries for a user's connections (and themselves).
 * Pass pre-resolved `connectedIds` to skip the connections sub-query.
 */
export async function fetchActivityFeed(
  userId: string,
  limit = 20,
  connectedIds?: string[],
  offset = 0,
): Promise<ActivityItem[]> {
  // Resolve connected IDs only if not provided
  const ids: string[] = connectedIds ?? await resolveConnectedIds(userId);

  const { data, error } = await supabase
    .from('activity_feed')
    .select(`
      id,
      user_id,
      activity_type,
      data,
      created_at,
      profile:profiles!activity_feed_user_id_fkey(full_name, avatar_url)
    `)
    .in('user_id', ids)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    user_name: row.profile?.full_name ?? 'Unknown',
    user_avatar: row.profile?.avatar_url ?? null,
    activity_type: row.activity_type,
    data: row.data ?? {},
    created_at: row.created_at,
  }));
}

// ─── Upcoming Matches ───────────────────────────────────────────────────────

export interface MatchItem {
  id: string;
  // player1 is always the challenge sender
  player1: { id: string; full_name: string; avatar_url: string | null };
  player2: { id: string; full_name: string; avatar_url: string | null };
  opponent: { id: string; full_name: string; avatar_url: string | null }; // relative to current user
  venue_name: string | null;
  scheduled_at: string;
  status: string;
  notes: string | null;
}

/**
 * Fetch upcoming matches (pending or confirmed, future date) for a user.
 */
export async function fetchUpcomingMatches(userId: string): Promise<MatchItem[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('matches')
    .select(`
      id,
      scheduled_at,
      status,
      notes,
      player1:profiles!matches_player1_id_fkey(id, full_name, avatar_url),
      player2:profiles!matches_player2_id_fkey(id, full_name, avatar_url),
      venue:venues(name)
    `)
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .in('status', ['pending', 'confirmed'])
    .gte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(10);

  if (error || !data) return [];

  return (data as any[]).map((row) => {
    const p1 = row.player1 ?? { id: '', full_name: 'Unknown', avatar_url: null };
    const p2 = row.player2 ?? { id: '', full_name: 'Unknown', avatar_url: null };
    const opponent = p1.id === userId ? p2 : p1;
    return {
      id: row.id,
      player1: p1,
      player2: p2,
      opponent,
      venue_name: row.venue?.name ?? null,
      scheduled_at: row.scheduled_at,
      status: row.status,
      notes: row.notes ?? null,
    };
  });
}

// ─── Recent Check-ins ───────────────────────────────────────────────────────

export interface CheckinItem {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  venue_id: string;
  venue_name: string;
  checked_in_at: string;
}

/**
 * Fetch recent check-ins from accepted connections.
 * Pass pre-resolved `connectedIds` (excluding self) to skip the connections sub-query.
 */
export async function fetchConnectionCheckins(
  userId: string,
  limit = 5,
  connectedIds?: string[],
): Promise<CheckinItem[]> {
  // Resolve peers (exclude self — we only show connections' check-ins)
  let peerIds: string[];
  if (connectedIds) {
    peerIds = connectedIds.filter((id) => id !== userId);
  } else {
    const all = await resolveConnectedIds(userId);
    peerIds = all.filter((id) => id !== userId);
  }

  if (peerIds.length === 0) return [];

  const { data, error } = await supabase
    .from('user_venue_checkins')
    .select(`
      user_id,
      venue_id,
      checked_in_at,
      profile:profiles!user_venue_checkins_user_id_fkey(full_name, avatar_url),
      venue:venues!user_venue_checkins_venue_id_fkey(name)
    `)
    .in('user_id', peerIds)
    .order('checked_in_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    user_id: row.user_id,
    user_name: row.profile?.full_name ?? 'Unknown',
    user_avatar: row.profile?.avatar_url ?? null,
    venue_id: row.venue_id,
    venue_name: row.venue?.name ?? 'Unknown Venue',
    checked_in_at: row.checked_in_at,
  }));
}
