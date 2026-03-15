import { supabase } from '../supabase';
import type { Profile } from '../types';

export interface PlayerCard {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  skill_level: string | null;
  playing_styles: string[];
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_m?: number;
  connection_status?: 'none' | 'pending' | 'accepted' | 'sent';
}

/**
 * Search players using the PostGIS get_players_nearby RPC for accurate proximity.
 * Falls back to client-side filtering if coordinates are not available.
 */
export async function searchPlayers(
  userId: string,
  opts: {
    lat?: number;
    lng?: number;
    radiusKm?: number;
    skillLevel?: string;
    query?: string;
    limit?: number;
  },
): Promise<PlayerCard[]> {
  // Use the RPC if coordinates are available
  if (opts.lat && opts.lng) {
    return fetchNearbyPlayers(opts.lat, opts.lng, opts.radiusKm ?? 10, opts.skillLevel, opts.query);
  }

  // Fallback: basic query without proximity (rare case — only on first load before geolocation)
  let qb = supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, skill_level, playing_styles, city, latitude, longitude')
    .neq('id', userId)
    .eq('setup_complete', true)
    .eq('profile_visibility', 'public');

  if (opts.skillLevel && opts.skillLevel !== 'Nearby') {
    qb = qb.eq('skill_level', opts.skillLevel.toLowerCase());
  }
  if (opts.query) {
    qb = qb.ilike('full_name', `%${opts.query}%`);
  }

  const { data, error } = await qb.limit(opts.limit ?? 50);
  if (error || !data) return [];
  return data as PlayerCard[];
}

/**
 * Fetch nearby players using the PostGIS get_players_nearby RPC.
 * Returns players sorted by distance (nearest first).
 */
export async function fetchNearbyPlayers(
  lat: number,
  lng: number,
  radiusKm: number,
  skillLevel?: string,
  nameQuery?: string,
): Promise<PlayerCard[]> {
  const skill = (skillLevel && skillLevel !== 'Nearby') ? skillLevel.toLowerCase() : null;
  
  const { data, error } = await supabase.rpc('get_players_nearby', {
    lat,
    lng,
    radius_km: radiusKm,
    skill,
  });

  if (error || !data) return [];

  let players = (data as Profile[]).map(p => ({
    id: p.id,
    full_name: p.full_name,
    username: p.username,
    avatar_url: p.avatar_url,
    skill_level: p.skill_level,
    playing_styles: p.playing_styles ?? [],
    city: p.city,
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  // Client-side name filter (RPC doesn't support text search)
  if (nameQuery) {
    players = players.filter(p => 
      p.full_name.toLowerCase().includes(nameQuery.toLowerCase()) ||
      p.username.toLowerCase().includes(nameQuery.toLowerCase())
    );
  }

  // Add distance_m (calculate from PostGIS — RPC returns sorted by distance but doesn't expose the value)
  // For display purposes, recalculate with Haversine
  players = players.map(p => {
    if (p.latitude == null || p.longitude == null) return { ...p, distance_m: undefined };
    const dLat = ((p.latitude - lat) * Math.PI) / 180;
    const dLng = ((p.longitude - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((p.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const distance_m = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return { ...p, distance_m };
  });

  return players;
}
