// src/stores/locationStore.ts
import { create } from 'zustand';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '../lib/supabase';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface LocationState {
  coords: Coords | null;
  permissionStatus: 'unknown' | 'granted' | 'denied';
  isLocating: boolean;
  error: string | null;
  requestAndFetch: (userId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  coords: null as Coords | null,
  permissionStatus: 'unknown' as const,
  isLocating: false,
  error: null as string | null,
};

export const useLocationStore = create<LocationState>()((set) => ({
  ...initialState,

  requestAndFetch: async (userId: string) => {
    set({ isLocating: true, error: null });
    try {
      // Check existing permission status
      const perm = await Geolocation.checkPermissions();
      const status = perm.location;

      if (status === 'prompt' || status === 'prompt-with-rationale') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          set({ permissionStatus: 'denied', isLocating: false });
          return;
        }
      } else if (status === 'denied') {
        set({ permissionStatus: 'denied', isLocating: false });
        return;
      }

      set({ permissionStatus: 'granted' });

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      const coords: Coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      set({ coords, isLocating: false });

      // Persist lat/lng + presence to Supabase (fire-and-forget)
      supabase
        .from('profiles')
        .update({
          latitude: coords.latitude,
          longitude: coords.longitude,
          is_online: true,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .then(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Location unavailable';
      set({ isLocating: false, error: msg });
    }
  },

  reset: () => set(initialState),
}));
