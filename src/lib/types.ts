// src/lib/types.ts

// Matches the profiles table schema exactly
export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  date_of_birth: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  skill_level: 'beginner' | 'casual' | 'intermediate' | 'advanced' | 'professional' | null;
  playing_styles: string[];
  grips: string[];
  techniques: string[];
  setup_complete: boolean;
  is_online: boolean;
  last_seen_at: string | null;
  profile_visibility: 'public' | 'connections_only';
  show_location: boolean;
  show_online_status: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlot {
  id: string;
  user_id: string;
  day_of_week: number;
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface PreferredVenue {
  user_id: string;
  venue_id: string;
  created_at: string;
  venue: {
    id: string;
    name: string;
    address: string;
    average_rating: number;
  } | null;
}

export interface ProfileActivity {
  id: string;
  user_id: string;
  activity_type: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon_url: string | null;
  category: 'social' | 'venues' | 'matches' | 'general';
  sort_order: number;
}

export interface UserAchievement {
  user_id: string;
  earned_at: string;
  achievement: Achievement | null;
}

export interface AchievementWithStatus extends Achievement {
  earned: boolean;
  earned_at: string | null;
}

export interface NotificationPreferences {
  user_id: string;
  match_requests: boolean;
  connection_requests: boolean;
  messages: boolean;
  community_activity: boolean;
  venue_updates: boolean;
}

// Screens within the unauthenticated auth flow
export type AuthScreen = 'login' | 'register' | 'forgot-password';

// All top-level screens App.tsx can render
export type AppScreen =
  | 'splash'
  | 'loading'
  | 'onboarding'
  | 'auth'           // sub-routed by AuthScreen
  | 'profile-setup'
  | 'home'
  | 'notifications';
