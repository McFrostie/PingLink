import { create } from 'zustand';
import {
  fetchMyMatches,
  fetchMatchById,
  createMatch,
  respondToMatch,
  cancelMatch,
  completeMatch,
  type Match,
  type CreateMatchPayload,
} from '../lib/queries/matches';
import { isStale } from '../lib/utils/cache';

const MATCHES_TTL = 2 * 60 * 1000; // 2 minutes

interface MatchesState {
  myMatches: Match[];
  selectedMatch: Match | null;
  isLoading: boolean;
  isLoadingDetail: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  fetchMyMatches: (userId: string, force?: boolean) => Promise<void>;
  fetchDetail: (matchId: string) => Promise<void>;
  create: (payload: CreateMatchPayload) => Promise<string | null>;
  respond: (matchId: string, accept: boolean) => Promise<boolean>;
  cancel: (matchId: string) => Promise<boolean>;
  complete: (matchId: string) => Promise<boolean>;
  clearDetail: () => void;
  reset: () => void;
}

const initialState = {
  myMatches: [] as Match[],
  selectedMatch: null as Match | null,
  isLoading: false,
  isLoadingDetail: false,
  error: null as string | null,
  lastFetchedAt: null as number | null,
};

export const useMatchesStore = create<MatchesState>()((set, get) => ({
  ...initialState,

  fetchMyMatches: async (userId, force = false) => {
    const { lastFetchedAt, myMatches } = get();
    if (!force && myMatches.length > 0 && !isStale(lastFetchedAt, MATCHES_TTL)) return;
    set({ isLoading: true, error: null });
    try {
      const matches = await fetchMyMatches(userId);
      set({ myMatches: matches, isLoading: false, lastFetchedAt: Date.now() });
    } catch (err) {
      set({ isLoading: false, error: 'Failed to load matches' });
    }
  },

  fetchDetail: async (matchId) => {
    set({ isLoadingDetail: true, selectedMatch: null });
    const match = await fetchMatchById(matchId);
    set({ selectedMatch: match, isLoadingDetail: false });
  },

  create: async (payload) => {
    const matchId = await createMatch(payload);
    if (matchId) {
      // Optimistically refresh list for the creator
      const { myMatches } = get();
      const newMatch = await fetchMatchById(matchId);
      if (newMatch) {
        set({ myMatches: [newMatch, ...myMatches] });
      }
    }
    return matchId;
  },

  respond: async (matchId, accept) => {
    const ok = await respondToMatch(matchId, accept);
    if (ok) {
      const updated = await fetchMatchById(matchId);
      set(state => ({
        myMatches: state.myMatches.map(m => m.id === matchId ? (updated ?? m) : m),
        selectedMatch: state.selectedMatch?.id === matchId ? (updated ?? state.selectedMatch) : state.selectedMatch,
      }));
    }
    return ok;
  },

  cancel: async (matchId) => {
    const ok = await cancelMatch(matchId);
    if (ok) {
      const updated = await fetchMatchById(matchId);
      set(state => ({
        myMatches: state.myMatches.map(m => m.id === matchId ? (updated ?? m) : m),
        selectedMatch: state.selectedMatch?.id === matchId ? (updated ?? state.selectedMatch) : state.selectedMatch,
        lastFetchedAt: null, // bust cache after mutation
      }));
    }
    return ok;
  },

  complete: async (matchId) => {
    const ok = await completeMatch(matchId);
    if (ok) {
      const updated = await fetchMatchById(matchId);
      set(state => ({
        myMatches: state.myMatches.map(m => m.id === matchId ? (updated ?? m) : m),
        selectedMatch: state.selectedMatch?.id === matchId ? (updated ?? state.selectedMatch) : state.selectedMatch,
      }));
    }
    return ok;
  },

  clearDetail: () => set({ selectedMatch: null }),

  reset: () => set(initialState),
}));
