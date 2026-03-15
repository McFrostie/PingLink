// src/stores/homeFeedStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import {
  fetchActivityFeed,
  fetchUpcomingMatches,
  fetchConnectionCheckins,
  resolveConnectedIds,
  type ActivityItem,
  type MatchItem,
  type CheckinItem,
} from '../lib/queries/feed';
import { isStale } from '../lib/utils/cache';
import type { RealtimeChannel } from '@supabase/supabase-js';

const FEED_TTL = 2 * 60 * 1000; // 2 minutes

interface HomeFeedState {
  activities: ActivityItem[];
  matches: MatchItem[];
  checkins: CheckinItem[];
  unreadNotifCount: number;
  isLoadingMatches: boolean;
  isLoadingFeed: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  feedChannels: RealtimeChannel[];

  fetchAll: (userId: string, force?: boolean) => Promise<void>;
  refresh: (userId: string) => Promise<void>;
  fetchUnreadCount: (userId: string) => Promise<void>;
  subscribeToFeed: (userId: string, connectedIds: string[]) => void;
  unsubscribeFromFeed: () => void;
  reset: () => void;
}

const initialState = {
  activities: [] as ActivityItem[],
  matches: [] as MatchItem[],
  checkins: [] as CheckinItem[],
  unreadNotifCount: 0,
  isLoadingMatches: false,
  isLoadingFeed: false,
  isRefreshing: false,
  error: null as string | null,
  lastFetchedAt: null as number | null,
  feedChannels: [] as RealtimeChannel[],
};

export const useHomeFeedStore = create<HomeFeedState>()((set, get) => ({
  ...initialState,

  fetchAll: async (userId: string, force = false) => {
    const { lastFetchedAt, matches, activities } = get();
    const hasData = matches.length > 0 || activities.length > 0;
    if (!force && hasData && !isStale(lastFetchedAt, FEED_TTL)) return;

    // Both loading flags on
    set({ isLoadingMatches: true, isLoadingFeed: true, error: null });

    // ── Phase 1: connections lookup (shared by both feed queries) ───────────
    const connectedIds = await resolveConnectedIds(userId);

    // ── Phase 2: fire all three queries in parallel, but resolve independently
    const matchesPromise = fetchUpcomingMatches(userId).then((matches) => {
      set({ matches, isLoadingMatches: false });
    });

    const feedPromise = Promise.all([
      fetchActivityFeed(userId, 20, connectedIds),
      fetchConnectionCheckins(userId, 5, connectedIds),
    ]).then(([activities, checkins]) => {
      set({ activities, checkins, isLoadingFeed: false, lastFetchedAt: Date.now() });
    });

    try {
      await Promise.all([matchesPromise, feedPromise]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load feed';
      set({ isLoadingMatches: false, isLoadingFeed: false, error: msg });
    }
  },

  refresh: async (userId: string) => {
    set({ isRefreshing: true });
    try {
      await get().fetchAll(userId, true);
    } finally {
      set({ isRefreshing: false });
    }
  },

  fetchUnreadCount: async (userId: string) => {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    set({ unreadNotifCount: count ?? 0 });
  },

  subscribeToFeed: (userId: string, connectedIds: string[]) => {
    // Avoid duplicate subscriptions
    get().unsubscribeFromFeed();

    const connectedSet = new Set(connectedIds);

    // Channel A: new activity_feed rows
    const activityChannel = supabase
      .channel(`home_activity_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_feed' },
        (payload) => {
          const row = payload.new as ActivityItem & { user_id: string };
          if (!connectedSet.has(row.user_id)) return;
          set((s) => ({
            activities: [row, ...s.activities].slice(0, 30),
          }));
        },
      )
      .subscribe();

    // Channel B: new/updated matches
    const matchesChannel = supabase
      .channel(`home_matches_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'matches' },
        (payload) => {
          const row = payload.new as { player1_id: string; player2_id: string; scheduled_at: string; status: string };
          if (row.player1_id !== userId && row.player2_id !== userId) return;
          if (row.status !== 'pending' && row.status !== 'confirmed') return;
          if (new Date(row.scheduled_at) < new Date()) return;
          // Re-fetch matches list to get fully-joined data
          fetchUpcomingMatches(userId).then((matches) => set({ matches }));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload) => {
          const row = payload.new as { id: string; player1_id: string; player2_id: string; status: string; scheduled_at: string };
          if (row.player1_id !== userId && row.player2_id !== userId) return;
          fetchUpcomingMatches(userId).then((matches) => set({ matches }));
        },
      )
      .subscribe();

    set({ feedChannels: [activityChannel, matchesChannel] });
  },

  unsubscribeFromFeed: () => {
    const { feedChannels } = get();
    feedChannels.forEach((ch) => ch.unsubscribe());
    set({ feedChannels: [] });
  },

  reset: () => {
    get().unsubscribeFromFeed();
    set(initialState);
  },
}));

