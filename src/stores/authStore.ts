// src/stores/authStore.ts
import { create } from 'zustand';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;

  /**
   * TRUE only during the very first app boot, while waiting for INITIAL_SESSION
   * to fire from onAuthStateChange.
   *
   * NEVER set this to true in login/signup/logout — doing so would freeze the
   * UI because those actions are gated by this flag in LoadingScreen.
   */
  isLoading: boolean;

  /**
   * TRUE while a login/signup/logout API call is in-flight.
   * Used ONLY for disabling buttons and showing inline spinners.
   * Has zero effect on screen routing.
   */
  isSubmitting: boolean;

  error: string | null;

  // Derived convenience flags — recomputed on every set()
  isAuthenticated: boolean;

  // Actions
  handleAuthEvent: (event: AuthChangeEvent, session: Session | null) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  session: null as Session | null,
  profile: null as Profile | null,
  isLoading: true,        // starts true — resolved exclusively by INITIAL_SESSION
  isSubmitting: false,
  error: null as string | null,
  isAuthenticated: false,
};

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data as Profile;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  ...initialState,

  /**
   * Called from AuthProvider via setTimeout (never directly inside the
   * onAuthStateChange callback — see AuthProvider for why).
   *
   * This is the ONLY place that sets isLoading: false.
   */
  handleAuthEvent: async (_event: AuthChangeEvent, newSession: Session | null) => {
    let newProfile: Profile | null = null;
    if (newSession?.user) {
      newProfile = await fetchProfile(newSession.user.id);
    }
    set({
      session: newSession,
      profile: newProfile,
      isLoading: false,
      isAuthenticated: !!newSession,
    });
  },

  /**
   * Sign in with email + password.
   *
   * Uses isSubmitting (NOT isLoading) to avoid freezing screen routing.
   * Updates state directly from the API response so routing reacts immediately
   * without waiting for the async onAuthStateChange callback.
   */
  login: async (email, password) => {
    set({ isSubmitting: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const session = data.session;
      const profile = session?.user ? await fetchProfile(session.user.id) : null;

      set({
        session,
        profile,
        isSubmitting: false,
        isLoading: false,
        isAuthenticated: !!session,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
      set({ isSubmitting: false, error: msg });
      throw err;
    }
  },

  /**
   * Create a new account.
   * Returns { needsConfirmation: true } when Supabase requires email verification
   * (determined by whether a session was returned).
   * The handle_new_user DB trigger creates the profiles row automatically.
   */
  signup: async (email, password, fullName) => {
    set({ isSubmitting: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
      if (error) throw error;

      const session = data.session;

      if (session) {
        // Email confirmation disabled in Supabase — user is immediately signed in
        const profile = await fetchProfile(session.user.id);
        set({
          session,
          profile,
          isSubmitting: false,
          isLoading: false,
          isAuthenticated: true,
        });
        return { needsConfirmation: false };
      } else {
        // Email confirmation enabled — user must verify before session is created
        set({ isSubmitting: false });
        return { needsConfirmation: true };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign up failed. Please try again.';
      set({ isSubmitting: false, error: msg });
      throw err;
    }
  },

  logout: async () => {
    set({ isSubmitting: true, error: null });
    try {
      await supabase.auth.signOut();
      // onAuthStateChange SIGNED_OUT fires → AuthProvider calls resetAllStores()
      // which calls reset() below. Also set here for instant feedback.
      set({ ...initialState, isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign out failed.';
      set({ isSubmitting: false, error: msg });
      throw err;
    }
  },

  refreshProfile: async () => {
    const { session } = get();
    if (!session?.user) return;
    const profile = await fetchProfile(session.user.id);
    if (profile) {
      set({ profile, isAuthenticated: true });
    }
  },

  clearError: () => set({ error: null }),

  // Called by resetAllStores() on SIGNED_OUT
  reset: () => set({ ...initialState, isLoading: false }),
}));
