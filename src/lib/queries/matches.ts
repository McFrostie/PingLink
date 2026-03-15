import { supabase } from '../supabase';

export type MatchStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface MatchPlayer {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  skill_level: string | null;
}

export interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  venue_id: string | null;
  venue_name: string | null;
  scheduled_at: string;
  status: MatchStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  player1: MatchPlayer | null;
  player2: MatchPlayer | null;
  score_player_1: number | null;
  score_player_2: number | null;
  winner_id: string | null;
}

const PLAYER_FIELDS = 'id, full_name, username, avatar_url, skill_level';

function mapMatch(row: any): Match {
  return {
    id: row.id,
    player1_id: row.player1_id,
    player2_id: row.player2_id,
    venue_id: row.venue?.id ?? null,
    venue_name: row.venue?.name ?? null,
    scheduled_at: row.scheduled_at,
    status: row.status,
    notes: row.notes ?? null,
    created_by: row.created_by,
    created_at: row.created_at,
    player1: row.p1 ?? null,
    player2: row.p2 ?? null,
    score_player_1: row.score_player_1 ?? null,
    score_player_2: row.score_player_2 ?? null,
    winner_id: row.winner_id ?? null,
  };
}

/** All matches where user is player1 or player2 */
export async function fetchMyMatches(userId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      id, player1_id, player2_id, scheduled_at, status, notes, created_by, created_at,
      score_player_1, score_player_2, winner_id,
      venue:venues(id, name),
      p1:player1_id(${PLAYER_FIELDS}),
      p2:player2_id(${PLAYER_FIELDS})
    `)
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .order('scheduled_at', { ascending: true });

  if (error || !data) return [];
  return (data as any[]).map(mapMatch);
}

/** Upcoming pending matches for display on HomeFeed discovery section */
export async function fetchUpcomingMatches(limit = 10): Promise<Match[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('matches')
    .select(`
      id, player1_id, player2_id, scheduled_at, status, notes, created_by, created_at,
      score_player_1, score_player_2, winner_id,
      venue:venues(id, name),
      p1:player1_id(${PLAYER_FIELDS}),
      p2:player2_id(${PLAYER_FIELDS})
    `)
    .eq('status', 'pending')
    .gte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return (data as any[]).map(mapMatch);
}

/** Single match detail */
export async function fetchMatchById(id: string): Promise<Match | null> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      id, player1_id, player2_id, scheduled_at, status, notes, created_by, created_at,
      score_player_1, score_player_2, winner_id,
      venue:venues(id, name),
      p1:player1_id(${PLAYER_FIELDS}),
      p2:player2_id(${PLAYER_FIELDS})
    `)
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapMatch(data as any);
}

export interface CreateMatchPayload {
  player2_id: string;   // the challenge recipient
  venue_id: string | null;
  scheduled_at: string; // ISO string
  notes: string;
  created_by: string;   // = player1_id
}

/** Create a match challenge — creator is always player1 */
export async function createMatch(payload: CreateMatchPayload): Promise<string | null> {
  const { data, error } = await supabase
    .from('matches')
    .insert({
      player1_id: payload.created_by,
      player2_id: payload.player2_id,
      venue_id: payload.venue_id,
      scheduled_at: payload.scheduled_at,
      notes: payload.notes || null,
      created_by: payload.created_by,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('createMatch error:', error);
    return null;
  }
  return (data as any).id as string;
}

/** Player2 responds: accept → confirmed, decline → cancelled */
export async function respondToMatch(
  matchId: string,
  accept: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from('matches')
    .update({ status: accept ? 'confirmed' : 'cancelled' })
    .eq('id', matchId);
  return !error;
}

/** Creator cancels their own match */
export async function cancelMatch(matchId: string): Promise<boolean> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'cancelled' })
    .eq('id', matchId);
  return !error;
}

/** Either player marks a confirmed match as completed */
export async function completeMatch(matchId: string): Promise<boolean> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'completed' })
    .eq('id', matchId);
  return !error;
}

/** Record score and winner for a completed match */
export async function recordMatchScore(
  matchId: string,
  scorePlayer1: number,
  scorePlayer2: number,
  winnerId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('matches')
    .update({
      score_player_1: scorePlayer1,
      score_player_2: scorePlayer2,
      winner_id: winnerId,
      status: 'completed'
    })
    .eq('id', matchId);
  return !error;
}
