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

/**
 * Fallback to browser's native Geolocation API (for web development)
 */
function getLocationFromBrowser(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 0,
        });
      },
      (err) => {
        reject(new Error(`Geolocation error: ${err.message}`));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export const useLocationStore = create<LocationState>()((set) => ({
  ...initialState,

  requestAndFetch: async (userId: string) => {
    set({ isLocating: true, error: null });
    try {
      let coords: Coords;
      let useCapacitor = true;

      // Try Capacitor first (for mobile)
      try {
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

        coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
      } catch (capacitorErr) {
        // Fallback to browser's native Geolocation API (for web development)
        if (!import.meta.env.VITE_WEB_PLATFORM) {
          // Not explicitly running as web platform, but Capacitor failed
          // Try browser API anyway
          try {
            coords = await getLocationFromBrowser();
            useCapacitor = false;
          } catch (browserErr) {
            throw capacitorErr; // Re-throw original error if browser API also fails
          }
        } else {
          throw capacitorErr;
        }
      }

      set({ permissionStatus: 'granted' });

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

      set({ coords, isLocating: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Location unavailable';
      set({ isLocating: false, error: msg });
    }
  },

  reset: () => set(initialState),
}));
