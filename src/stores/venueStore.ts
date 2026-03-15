// src/stores/venueStore.ts
import { create } from 'zustand';
import {
  fetchNearbyVenues,
  fetchVenueDetail,
  DEFAULT_FILTERS,
  type NearbyVenue,
  type VenueDetail,
  type VenueFilters,
} from '../lib/queries/venues';
import { isStale } from '../lib/utils/cache';

const VENUE_TTL = 5 * 60 * 1000; // 5 minutes

interface VenueState {
  venues: NearbyVenue[];
  selectedVenue: VenueDetail | null;
  filters: VenueFilters;
  isLoading: boolean;
  isLoadingDetail: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  fetchNearby: (lat: number, lng: number, filters?: Partial<VenueFilters>, force?: boolean) => Promise<void>;
  fetchAll: (lat: number, lng: number) => Promise<void>;
  fetchDetail: (venueId: string) => Promise<void>;
  setFilters: (filters: Partial<VenueFilters>) => void;
  clearSelectedVenue: () => void;
  submitReview: (venueId: string, rating: number, body: string) => Promise<boolean>;
  reset: () => void;
}

export const useVenueStore = create<VenueState>()((set, get) => ({
  venues: [],
  selectedVenue: null,
  filters: DEFAULT_FILTERS,
  isLoading: false,
  isLoadingDetail: false,
  error: null,
  lastFetchedAt: null,

  fetchNearby: async (lat, lng, filters, force = false) => {
    const merged: VenueFilters = { ...get().filters, ...filters };
    const { lastFetchedAt, venues } = get();
    if (!force && venues.length > 0 && !isStale(lastFetchedAt, VENUE_TTL)) {
      // Still update the merged filters in state even on cache hit
      set({ filters: merged });
      return;
    }
    set({ isLoading: true, error: null, filters: merged });
    try {
      const results = await fetchNearbyVenues(lat, lng, merged);
      set({ venues: results, isLoading: false, lastFetchedAt: Date.now() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load venues';
      set({ isLoading: false, error: msg });
    }
  },

  // Fetch every venue globally (always forces a fresh fetch — ignores TTL)
  fetchAll: async (lat, lng) => {
    set({ isLoading: true, error: null });
    try {
      const results = await fetchNearbyVenues(lat, lng, { ...get().filters, radiusKm: 100000 });
      set({ venues: results, isLoading: false, lastFetchedAt: Date.now() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load venues';
      set({ isLoading: false, error: msg });
    }
  },

  fetchDetail: async (venueId) => {
    set({ isLoadingDetail: true, selectedVenue: null });
    const detail = await fetchVenueDetail(venueId);
    set({ selectedVenue: detail, isLoadingDetail: false });
  },

  setFilters: (filters) =>
    set((s) => ({ filters: { ...s.filters, ...filters } })),

  clearSelectedVenue: () => set({ selectedVenue: null }),

  submitReview: async (venueId: string, rating: number, body: string) => {
    const { useAuthStore } = await import('./authStore');
    const userId = useAuthStore.getState().profile?.id;
    if (!userId) return false;

    const { submitReview } = await import('../lib/queries/venues');
    const success = await submitReview(venueId, userId, rating, body);
    if (success) {
      // Re-fetch venue detail to show the new review
      await get().fetchDetail(venueId);
    }
    return success;
  },

  reset: () =>
    set({
      venues: [],
      selectedVenue: null,
      filters: DEFAULT_FILTERS,
      isLoading: false,
      isLoadingDetail: false,
      error: null,
      lastFetchedAt: null,
    }),
}));
