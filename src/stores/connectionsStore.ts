import { create } from 'zustand';
import {
  fetchConnections, fetchPendingRequests, fetchSentRequests,
  sendConnectionRequest, respondToRequest, type Connection,
} from '../lib/queries/connections';
import { useAuthStore } from './authStore';
import { isStale } from '../lib/utils/cache';

const CONNECTIONS_TTL = 2 * 60 * 1000; // 2 minutes

interface ConnectionsState {
  accepted: Connection[];
  pending: Connection[];
  sent: Connection[];
  isLoading: boolean;
  lastFetchedAt: number | null;
  fetchAll: (userId: string, force?: boolean) => Promise<void>;
  send: (requesterId: string, addresseeId: string) => Promise<boolean>;
  respond: (connectionId: string, accept: boolean) => Promise<boolean>;
  reset: () => void;
}

export const useConnectionsStore = create<ConnectionsState>()((set, get) => ({
  accepted: [],
  pending: [],
  sent: [],
  isLoading: false,
  lastFetchedAt: null,

  fetchAll: async (userId, force = false) => {
    const state = get();
    if (!force && state.accepted.length > 0 && !isStale(state.lastFetchedAt, CONNECTIONS_TTL)) return;
    set({ isLoading: true });
    const [accepted, pending, sent] = await Promise.all([
      fetchConnections(userId),
      fetchPendingRequests(userId),
      fetchSentRequests(userId),
    ]);
    set({ accepted, pending, sent, isLoading: false, lastFetchedAt: Date.now() });
  },

  send: async (requesterId, addresseeId) => {
    const ok = await sendConnectionRequest(requesterId, addresseeId);
    if (ok) {
      // Re-fetch optimistic update (in a real app, we could push locally, but fetch is safer to get relations right)
      await get().fetchAll(requesterId);
    }
    return ok;
  },

  respond: async (connectionId, accept) => {
    const ok = await respondToRequest(connectionId, accept);
    if (ok) {
      set({ lastFetchedAt: null }); // bust cache so next visit re-fetches
      const userId = useAuthStore.getState().session?.user?.id;
      if (userId) await get().fetchAll(userId, true);
    }
    return ok;
  },

  reset: () => set({ accepted: [], pending: [], sent: [], isLoading: false, lastFetchedAt: null }),
}));
