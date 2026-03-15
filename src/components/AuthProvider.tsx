// src/components/AuthProvider.tsx
import React, { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useLocationStore } from '../stores/locationStore';
import { resetAllStores } from '../stores/resetStores';

interface AuthProviderProps {
  children: React.ReactNode;
}

/** Fetch location if the user has a complete profile. */
function triggerLocationIfReady(): void {
  const profile = useAuthStore.getState().profile;
  if (profile?.setup_complete && profile.id) {
    useLocationStore.getState().requestAndFetch(profile.id);
  }
}

/**
 * AuthProvider mounts once at the top of the tree (in main.tsx).
 * It owns the Supabase auth subscription and Capacitor lifecycle.
 * It does NOT render a loading gate — App.tsx handles routing logic.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const handleAuthEvent = useAuthStore((s) => s.handleAuthEvent);

  // ── 1. Single auth subscription ────────────────────────────────────────────
  //
  // INITIAL_SESSION fires immediately when onAuthStateChange is called.
  // It either carries the restored session (user was logged in) or null
  // (user was not logged in / session expired).
  //
  // RULE: The callback must be SYNCHRONOUS.
  // Supabase awaits the callback internally. An async callback that calls
  // other Supabase methods creates a deadlock → app freezes on tab/app resume.
  //
  // RULE: All async work (profile fetch) must go through setTimeout.
  //
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // ── SYNC ZONE — no awaits, no Supabase calls allowed here ──

      if (event === 'SIGNED_OUT') {
        // Reset synchronously so stale data never leaks to the next user
        resetAllStores();
        return;
      }

      // Dispatch async work (profile fetch + state update) outside the callback
      setTimeout(async () => {
        await handleAuthEvent(event, session);
        // After profile is loaded, request location if setup is complete
        triggerLocationIfReady();
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [handleAuthEvent]);

  // ── 2. Capacitor app lifecycle ──────────────────────────────────────────────
  //
  // On app resume: refresh the auth token and re-fetch location.
  //
  useEffect(() => {
    let listenerHandle: Awaited<ReturnType<typeof CapApp.addListener>> | null = null;

    const addListener = async () => {
      listenerHandle = await CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          supabase.auth.startAutoRefresh();
          // Re-fetch location every time the app comes to foreground
          triggerLocationIfReady();
        } else {
          supabase.auth.stopAutoRefresh();
        }
      });
    };

    addListener();

    return () => {
      listenerHandle?.remove();
    };
  }, []);

  return <>{children}</>;
}
