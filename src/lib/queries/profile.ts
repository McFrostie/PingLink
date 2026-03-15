import { supabase } from '../supabase';
import type {
  Achievement,
  AchievementWithStatus,
  AvailabilitySlot,
  NotificationPreferences,
  PreferredVenue,
  Profile,
  ProfileActivity,
  UserAchievement,
} from '../types';

type ProfilePatch = Partial<Pick<
  Profile,
  | 'username'
  | 'full_name'
  | 'avatar_url'
  | 'cover_url'
  | 'bio'
  | 'date_of_birth'
  | 'city'
  | 'skill_level'
  | 'playing_styles'
  | 'grips'
  | 'techniques'
  | 'profile_visibility'
  | 'show_location'
  | 'show_online_status'
>>;

export interface VenueSearchResult {
  id: string;
  name: string;
  address: string;
  average_rating: number;
}

export async function fetchProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<boolean> {
  const payload = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId);

  return !error;
}

export async function fetchUserAvailability(userId: string): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase
    .from('user_availability')
    .select('id, user_id, day_of_week, time_of_day')
    .eq('user_id', userId)
    .order('day_of_week', { ascending: true });

  if (error || !data) return [];
  return data as AvailabilitySlot[];
}

export async function syncUserAvailability(
  userId: string,
  slots: Array<Pick<AvailabilitySlot, 'day_of_week' | 'time_of_day'>>,
): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from('user_availability')
    .delete()
    .eq('user_id', userId);

  if (deleteError) return false;
  if (slots.length === 0) return true;

  const { error: insertError } = await supabase
    .from('user_availability')
    .insert(slots.map((slot) => ({ ...slot, user_id: userId })));

  return !insertError;
}

export async function fetchPreferredVenues(userId: string): Promise<PreferredVenue[]> {
  const { data, error } = await supabase
    .from('user_preferred_venues')
    .select(`
      user_id,
      venue_id,
      created_at,
      venue:venues(id, name, address, average_rating)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    user_id: row.user_id,
    venue_id: row.venue_id,
    created_at: row.created_at,
    venue: row.venue
      ? {
          id: row.venue.id,
          name: row.venue.name,
          address: row.venue.address,
          average_rating: row.venue.average_rating ?? 0,
        }
      : null,
  }));
}

export async function syncPreferredVenues(userId: string, venueIds: string[]): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from('user_preferred_venues')
    .delete()
    .eq('user_id', userId);

  if (deleteError) return false;
  if (venueIds.length === 0) return true;

  const { error: insertError } = await supabase
    .from('user_preferred_venues')
    .insert(venueIds.map((venueId) => ({ user_id: userId, venue_id: venueId })));

  return !insertError;
}

export async function searchPreferredVenueOptions(
  query: string,
  limit = 8,
): Promise<VenueSearchResult[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  const { data, error } = await supabase
    .from('venues')
    .select('id, name, address, average_rating')
    .eq('status', 'approved')
    .or(`name.ilike.%${normalized}%,address.ilike.%${normalized}%`)
    .order('average_rating', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    average_rating: row.average_rating ?? 0,
  }));
}

export async function fetchUserActivity(userId: string, limit = 5): Promise<ProfileActivity[]> {
  const { data, error } = await supabase
    .from('activity_feed')
    .select('id, user_id, activity_type, data, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as ProfileActivity[]).map((row) => ({
    ...row,
    data: row.data ?? {},
  }));
}

export async function fetchUserAchievements(userId: string): Promise<UserAchievement[]> {
  const { data, error } = await supabase
    .from('user_achievements')
    .select(`
      user_id,
      earned_at,
      achievement:achievements(id, code, name, description, icon_url, category, sort_order)
    `)
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    user_id: row.user_id,
    earned_at: row.earned_at,
    achievement: row.achievement
      ? {
          id: row.achievement.id,
          code: row.achievement.code,
          name: row.achievement.name,
          description: row.achievement.description,
          icon_url: row.achievement.icon_url ?? null,
          category: row.achievement.category,
          sort_order: row.achievement.sort_order,
        }
      : null,
  }));
}

export async function fetchAllAchievements(): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error || !data) return [];
  return data as Achievement[];
}

export async function fetchAchievementsWithStatus(userId: string): Promise<AchievementWithStatus[]> {
  const [allAchievements, userAchievements] = await Promise.all([
    fetchAllAchievements(),
    fetchUserAchievements(userId),
  ]);

  const earnedMap = new Map<string, string>();
  userAchievements.forEach((ua) => {
    if (ua.achievement) {
      earnedMap.set(ua.achievement.id, ua.earned_at);
    }
  });

  return allAchievements.map((achievement) => {
    const earnedAt = earnedMap.get(achievement.id);
    return {
      ...achievement,
      earned: !!earnedAt,
      earned_at: earnedAt || null,
    };
  }).sort((a, b) => {
    // Earned first, newest first
    if (a.earned && !b.earned) return -1;
    if (!a.earned && b.earned) return 1;
    if (a.earned && b.earned) {
      return new Date(b.earned_at!).getTime() - new Date(a.earned_at!).getTime();
    }
    // Both locked: sort by sort_order
    return a.sort_order - b.sort_order;
  });
}

export async function fetchNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data as NotificationPreferences;
}

export async function updateNotificationPreferences(
  userId: string,
  patch: Partial<Omit<NotificationPreferences, 'user_id'>>,
): Promise<boolean> {
  const { error } = await supabase
    .from('notification_preferences')
    .update(patch)
    .eq('user_id', userId);

  return !error;
}

export async function uploadProfileImage(
  userId: string,
  file: File,
  kind: 'avatar' | 'cover',
): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${userId}/${kind}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) return null;

  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export async function deleteMyAccount(): Promise<boolean> {
  const { error } = await supabase.rpc('delete_my_account');
  return !error;
}