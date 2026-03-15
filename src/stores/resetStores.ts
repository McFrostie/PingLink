// src/stores/resetStores.ts
import { useAuthStore } from './authStore';
import { useLocationStore } from './locationStore';
import { useHomeFeedStore } from './homeFeedStore';
import { useVenueStore } from './venueStore';
import { useConnectionsStore } from './connectionsStore';
import { useMessagesStore } from './messagesStore';
import { useMatchesStore } from './matchesStore';

/**
 * Resets every Zustand store to its initial state.
 * Called synchronously inside the onAuthStateChange SIGNED_OUT handler.
 */
export function resetAllStores(): void {
  useAuthStore.getState().reset();
  useLocationStore.getState().reset();
  useHomeFeedStore.getState().reset();
  useVenueStore.getState().reset();
  useConnectionsStore.getState().reset();
  useMessagesStore.getState().reset();
  useMatchesStore.getState().reset();
}
