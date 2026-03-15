// src/lib/queries/venues.ts
// All column names match the actual Supabase migrations exactly.
import { supabase } from '../supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FacilityType = 'club' | 'sports_center' | 'community_hall' | 'school' | 'commercial';

export interface NearbyVenue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  facility_type: FacilityType | null;
  amenities: string[];
  average_rating: number;
  review_count: number;
  checkin_count: number;
  is_verified: boolean;
  opening_hours: Record<string, { open: string; close: string }>;
  distance_m: number;
  // Joined from venue_photos (first primary photo)
  cover_url: string | null;
}

export interface VenueDetail extends NearbyVenue {
  num_tables: number;
  description: string | null;
  contact_phone: string | null;
  contact_website: string | null;
  photos: Array<{ id: string; url: string; is_primary: boolean; display_order: number }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    reviewer_name: string;
    created_at: string;
  }>;
  players_here: Array<{ user_id: string; full_name: string; avatar_url: string | null }>;
}

export interface VenueFilters {
  radiusKm: number;
  facilityType: FacilityType | null;
  minRating: number;
  amenities: string[];
}

export const DEFAULT_FILTERS: VenueFilters = {
  radiusKm: 25,
  facilityType: null,
  minRating: 0,
  amenities: [],
};

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Uses the existing get_venues_nearby RPC (defined in migration 006).
 * Returns venues sorted by distance ascending.
 * Amenities are filtered client-side for now (could be added to RPC for performance).
 */
export async function fetchNearbyVenues(
  lat: number,
  lng: number,
  filters: VenueFilters = DEFAULT_FILTERS,
): Promise<NearbyVenue[]> {
  const { data, error } = await supabase.rpc('get_venues_nearby', {
    lat,
    lng,
    radius_km: filters.radiusKm,
    p_facility_type: filters.facilityType ?? null,
    p_min_rating: filters.minRating,
  });

  if (error || !data) return [];

  let venues = data as any[];

  // Client-side amenities filter (could be moved to RPC with a migration for better performance)
  if (filters.amenities.length > 0) {
    venues = venues.filter((v: any) => {
      const venueAmenities = v.amenities ?? [];
      return filters.amenities.every(required => venueAmenities.includes(required));
    });
  }

  // Attach cover photos in a single batch query
  if (venues.length === 0) return [];

  const venueIds = venues.map((v: any) => v.id);
  const { data: photos } = await supabase
    .from('venue_photos')
    .select('venue_id, url, is_primary')
    .in('venue_id', venueIds)
    .eq('is_primary', true)
    .limit(venueIds.length);

  const coverMap: Record<string, string> = {};
  for (const p of photos ?? []) {
    coverMap[(p as any).venue_id] = (p as any).url;
  }

  return venues.map((v: any) => ({
    id: v.id,
    name: v.name,
    address: v.address,
    latitude: v.latitude,
    longitude: v.longitude,
    facility_type: v.facility_type ?? null,
    amenities: v.amenities ?? [],
    average_rating: v.average_rating ?? 0,
    review_count: v.review_count ?? 0,
    checkin_count: v.checkin_count ?? 0,
    is_verified: v.is_verified ?? false,
    opening_hours: v.opening_hours ?? {},
    distance_m: v.distance_m ?? 0,
    cover_url: coverMap[v.id] ?? null,
  }));
}

/** Full venue detail including photos, reviews, current check-ins. */
export async function fetchVenueDetail(venueId: string): Promise<VenueDetail | null> {
  const { data, error } = await supabase
    .from('venues')
    .select(`
      id, name, address, latitude, longitude,
      facility_type, num_tables, description, amenities,
      average_rating, review_count, checkin_count,
      is_verified, opening_hours,
      contact_phone, contact_website,
      venue_photos(id, url, is_primary, display_order),
      venue_reviews(
        id, rating, comment, created_at,
        reviewer:profiles!venue_reviews_user_id_fkey(full_name)
      ),
      user_venue_checkins(
        user_id,
        player:profiles!user_venue_checkins_user_id_fkey(full_name, avatar_url)
      )
    `)
    .eq('id', venueId)
    .single();

  if (error || !data) return null;

  const row = data as any;
  const photos = (row.venue_photos ?? []).sort(
    (a: any, b: any) => a.display_order - b.display_order,
  );
  const primaryPhoto = photos.find((p: any) => p.is_primary) ?? photos[0] ?? null;

  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    facility_type: row.facility_type ?? null,
    num_tables: row.num_tables ?? 0,
    description: row.description ?? null,
    amenities: row.amenities ?? [],
    average_rating: row.average_rating ?? 0,
    review_count: row.review_count ?? 0,
    checkin_count: row.checkin_count ?? 0,
    is_verified: row.is_verified ?? false,
    opening_hours: row.opening_hours ?? {},
    contact_phone: row.contact_phone ?? null,
    contact_website: row.contact_website ?? null,
    distance_m: 0,
    cover_url: primaryPhoto?.url ?? null,
    photos: photos.map((p: any) => ({
      id: p.id,
      url: p.url,
      is_primary: p.is_primary,
      display_order: p.display_order,
    })),
    reviews: (row.venue_reviews ?? []).map((r: any) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment ?? null,
      reviewer_name: r.reviewer?.full_name ?? 'Anonymous',
      created_at: r.created_at,
    })),
    players_here: (row.user_venue_checkins ?? []).map((c: any) => ({
      user_id: c.user_id,
      full_name: c.player?.full_name ?? 'Unknown',
      avatar_url: c.player?.avatar_url ?? null,
    })),
  };
}

/** Submit a new venue (status defaults to 'pending', reviewed by community). */
export async function insertVenue(
  userId: string,
  payload: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    facility_type: FacilityType | null;
    num_tables: number;
    amenities: string[];
    description: string;
    contact_phone: string;
    contact_website: string;
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from('venues')
    .insert({
      name: payload.name,
      address: payload.address,
      latitude: payload.latitude,
      longitude: payload.longitude,
      facility_type: payload.facility_type,
      num_tables: payload.num_tables,
      amenities: payload.amenities,
      description: payload.description || null,
      contact_phone: payload.contact_phone || null,
      contact_website: payload.contact_website || null,
      submitted_by: userId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data) return null;
  return (data as any).id;
}

/** Upload a photo to Supabase Storage and insert a venue_photos record. */
export async function uploadVenuePhoto(
  venueId: string,
  userId: string,
  file: File,
  isPrimary = false,
  displayOrder = 0,
): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${venueId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('venue-photos')
    .upload(path, file, { upsert: false, contentType: file.type });

  if (uploadError) return null;

  const { data: urlData } = supabase.storage.from('venue-photos').getPublicUrl(path);

  const { error: insertError } = await supabase.from('venue_photos').insert({
    venue_id: venueId,
    url: urlData.publicUrl,
    is_primary: isPrimary,
    display_order: displayOrder,
    uploaded_by: userId,
  });

  if (insertError) return null;
  return urlData.publicUrl;
}

/** Toggle check-in: insert if not present, delete if present. */
export async function toggleCheckin(
  userId: string,
  venueId: string,
): Promise<'checked_in' | 'checked_out'> {
  // Check if already checked in
  const { data: existing, error: checkError } = await supabase
    .from('user_venue_checkins')
    .select('user_id')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .maybeSingle();

  if (checkError) throw checkError;

  if (existing) {
    const { error: deleteError } = await supabase
      .from('user_venue_checkins')
      .delete()
      .eq('user_id', userId)
      .eq('venue_id', venueId);
    
    if (deleteError) throw deleteError;
    return 'checked_out';
  } else {
    const { error: insertError } = await supabase
      .from('user_venue_checkins')
      .insert({ user_id: userId, venue_id: venueId });
      
    if (insertError) throw insertError;
    return 'checked_in';
  }
}

/** Check if a user is currently checked in at a venue. */
export async function isCheckedIn(userId: string, venueId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_venue_checkins')
    .select('user_id')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .maybeSingle();
  return !!data;
}

/** Submit a review for a venue. */
export async function submitReview(
  venueId: string,
  userId: string,
  rating: number,
  body: string,
): Promise<boolean> {
  const { error } = await supabase.from('venue_reviews').insert({
    venue_id: venueId,
    user_id: userId,
    rating,
    comment: body || null,
  });
  return !error;
}

/**
 * Geocode an address string → lat/lng using Google Maps Geocoding API.
 * Returns null if the address cannot be found.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== 'OK' || !json.results?.[0]) return null;
    const loc = json.results[0].geometry.location;
    return {
      lat: loc.lat,
      lng: loc.lng,
      formattedAddress: json.results[0].formatted_address,
    };
  } catch {
    return null;
  }
}
