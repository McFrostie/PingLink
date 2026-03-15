# Supabase + React Router Auth & Session Management

## Skill Metadata

```
name: supabase-react-auth
description: Use when setting up authentication with Supabase in a React SPA using React Router and Zustand. Covers AuthProvider, session management, route guards, tab visibility, and inactivity timeout. MUST be followed for any Supabase + React auth implementation.
trigger: Setting up or modifying authentication in a React app with Supabase
type: rigid
```

---

## 1. Why This Document Exists

Three production bugs taught us these patterns the hard way:

| Bug | Root Cause | Lesson |
|-----|-----------|--------|
| Login doesn't redirect to dashboard | `login()` set `isLoading: true` which unmounted the BrowserRouter (it was a child of AuthProvider's loading gate). The `navigate()` call then used a stale reference from the unmounted router and silently failed. | **Never unmount the router during auth actions.** Separate "app is initializing" (`isLoading`) from "form is submitting" (`isSubmitting`). |
| Stuck at loading after tab switch | `onAuthStateChange` callback was `async` and called Supabase functions (profile fetch) directly inside. Supabase docs explicitly warn: *"Avoid async callbacks to prevent deadlocks"* and *"Do not use other Supabase functions directly in the callback."* When `SIGNED_IN` fires on tab refocus, the async callback deadlocked. | **Keep `onAuthStateChange` callback synchronous.** Dispatch async work via `setTimeout`. |
| Stuck at loading on page refresh | Two parallel initialization paths (`initialize()` + `INITIAL_SESSION` event) created a race condition where `initialize()` set `isLoading: true` after `handleAuthEvent` had already resolved it to `false`. | **Use `INITIAL_SESSION` as the single initialization path.** Never call `getSession()` separately. |

---

## 2. Architecture Overview

```
App Mount
    |
    v
AuthProvider (subscribes to onAuthStateChange)
    |
    |-- INITIAL_SESSION fires immediately (replaces manual initialize())
    |-- Sync callback dispatches async work via setTimeout
    |-- Gates entire app on isLoading (initial resolution only)
    |
    v
BrowserRouter (inside AuthProvider, never unmounted by form actions)
    |
    v
Routes
    |-- MainLayout (public pages + Navbar)
    |-- DashboardLayout (checks isLoading for initial gate, isAuthenticated for redirect)
    |-- AdminLayout (checks isModerator)
```

### Key Principles

1. **Single source of truth**: `onAuthStateChange` is the ONLY place that initializes and updates auth state. No separate `getSession()` call.
2. **Two loading states**: `isLoading` (blocks app render during initial session resolution) vs `isSubmitting` (disables form buttons during login/signup/logout).
3. **Sync callback**: The `onAuthStateChange` callback MUST be synchronous. All async work (profile fetching) is dispatched via `setTimeout(() => ..., 0)`.
4. **Direct state update on login**: `login()` updates session/profile in the store directly from the Supabase response, so `navigate()` works immediately without waiting for the async `onAuthStateChange` callback.
5. **Visibility handling**: `startAutoRefresh()` / `stopAutoRefresh()` on tab focus/blur prevents stale tokens.

---

## 3. Implementation Guide

### 3.1 Supabase Client

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

No special auth config needed. Supabase JS v2 handles token persistence and auto-refresh by default.

---

### 3.2 Auth Service

```typescript
// src/services/authService.ts
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

export const authService = {
  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data // IMPORTANT: return data so login() can read data.session directly
  },

  async signup(email: string, password: string, firstName: string, lastName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { firstName, lastName },
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    })
    if (error) throw error
    return data
  },

  async logout() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data as Profile
  },
}
```

**IMPORTANT**: `login()` MUST return `data` (which contains `data.session`). The auth store reads the session directly from this return value to update state immediately, without waiting for `onAuthStateChange`.

**IMPORTANT**: Do NOT add a `getSession()` method. Session initialization is handled exclusively by `onAuthStateChange` with the `INITIAL_SESSION` event. Calling `getSession()` separately creates race conditions.

---

### 3.3 Auth Store (Zustand)

This is the most critical file. Read every comment carefully.

```typescript
// src/stores/authStore.ts
import { create } from 'zustand'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { Profile } from '@/types'
import { authService } from '@/services/authService'

interface AuthState {
  session: Session | null
  profile: Profile | null

  /**
   * TRUE only during initial app boot while waiting for INITIAL_SESSION.
   * Gates the entire app via AuthProvider — when true, the app shows a spinner
   * and the BrowserRouter is NOT rendered.
   *
   * NEVER set this to true in login/signup/logout actions.
   * Doing so unmounts the BrowserRouter, which breaks navigate() calls.
   */
  isLoading: boolean

  /**
   * TRUE while a login/signup/logout API call is in-flight.
   * Used ONLY for disabling form buttons and showing button spinners.
   * Does NOT affect app-level rendering or routing.
   */
  isSubmitting: boolean

  error: string | null
  signupEmail: string | null

  // Derived flags — updated on every setState
  isAuthenticated: boolean
  isEmailVerified: boolean
  isVerified: boolean
  isAdmin: boolean
  isModerator: boolean
  isBanned: boolean

  // Actions
  handleAuthEvent: (event: AuthChangeEvent, session: Session | null) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  clearError: () => void
  reset: () => void
}

/**
 * Derive boolean flags from session + profile.
 * Called on every state update to keep flags in sync.
 */
function deriveFlags(session: Session | null, profile: Profile | null) {
  return {
    isAuthenticated: !!session,
    isEmailVerified: !!session?.user.email_confirmed_at,
    isVerified:
      !!session?.user.email_confirmed_at &&
      profile?.verification_status === 'verified',
    isAdmin: profile?.role === 'admin',
    isModerator: profile?.role === 'admin' || profile?.role === 'moderator',
    isBanned: profile?.is_banned ?? false,
  }
}

const initialState = {
  session: null as Session | null,
  profile: null as Profile | null,
  isLoading: true,       // starts true — resolved by INITIAL_SESSION
  isSubmitting: false,
  error: null as string | null,
  signupEmail: null as string | null,
  isAuthenticated: false,
  isEmailVerified: false,
  isVerified: false,
  isAdmin: false,
  isModerator: false,
  isBanned: false,
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  ...initialState,

  /**
   * Called by AuthProvider's onAuthStateChange listener (via setTimeout).
   * Handles INITIAL_SESSION (app boot), SIGNED_IN, TOKEN_REFRESHED, etc.
   *
   * This is the ONLY place that resolves isLoading from true to false.
   */
  handleAuthEvent: async (_event: AuthChangeEvent, newSession: Session | null) => {
    let newProfile: Profile | null = null
    if (newSession?.user) {
      try {
        newProfile = await authService.getProfile(newSession.user.id)
      } catch {
        // Profile may not exist yet (first load after signup / email confirmation)
      }
    }
    set({
      session: newSession,
      profile: newProfile,
      isLoading: false,
      ...deriveFlags(newSession, newProfile),
    })
  },

  /**
   * Login action.
   *
   * CRITICAL DESIGN DECISIONS:
   * 1. Uses isSubmitting (not isLoading) — isLoading gates the router,
   *    setting it true would unmount BrowserRouter and break navigate().
   * 2. Updates session/profile directly from authService.login() return value,
   *    so the component can call navigate() immediately after await login().
   *    The onAuthStateChange SIGNED_IN event will also fire later, but by then
   *    the user is already on the dashboard.
   */
  login: async (email, password) => {
    set({ isSubmitting: true, error: null })
    try {
      const data = await authService.login(email, password)
      const session = data.session
      let profile: Profile | null = null
      if (session?.user) {
        try {
          profile = await authService.getProfile(session.user.id)
        } catch {
          // Profile may not exist yet
        }
      }
      set({
        session,
        profile,
        isSubmitting: false,
        isLoading: false,
        ...deriveFlags(session, profile),
      })
    } catch (error) {
      set({
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'Login failed',
      })
      throw error
    }
  },

  signup: async (email, password, firstName, lastName) => {
    set({ isSubmitting: true, error: null })
    try {
      await authService.signup(email, password, firstName, lastName)
      set({ isSubmitting: false, signupEmail: email })
    } catch (error) {
      set({
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'Signup failed',
      })
      throw error
    }
  },

  logout: async () => {
    set({ isSubmitting: true, error: null })
    try {
      await authService.logout()
      // onAuthStateChange SIGNED_OUT in AuthProvider will call resetAllStores()
      set({
        session: null,
        profile: null,
        isSubmitting: false,
        isLoading: false,
        ...deriveFlags(null, null),
      })
    } catch (error) {
      set({
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      })
      throw error
    }
  },

  refreshProfile: async () => {
    const { session } = get()
    if (!session?.user) return
    try {
      const profile = await authService.getProfile(session.user.id)
      set({ profile, ...deriveFlags(session, profile) })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to refresh profile',
      })
    }
  },

  reset: () => set({ ...initialState, isLoading: false, isSubmitting: false }),
  clearError: () => set({ error: null }),
}))
```

### Why No `initialize()` Action?

Previous implementations had a separate `initialize()` that called `supabase.auth.getSession()`. This caused:

1. **Race condition**: `initialize()` and `INITIAL_SESSION` event both run on mount. If `initialize()` sets `isLoading: true` AFTER `handleAuthEvent` already resolved it to `false`, the app gets stuck.
2. **Redundant network calls**: Both paths fetch the session and profile, doubling API calls on every page load.
3. **Stale data risk**: `getSession()` reads from local storage cache without validating the JWT. Supabase docs recommend using `onAuthStateChange` for client-side auth state.

The `INITIAL_SESSION` event fires immediately when `onAuthStateChange` is subscribed. It IS the initialization. No separate call needed.

---

### 3.4 Reset Stores

```typescript
// src/lib/resetStores.ts
import { useAuthStore } from '@/stores/authStore'
// import all other Zustand stores...

/**
 * Reset every Zustand store back to its initial state.
 * Called on SIGNED_OUT so no stale data from the previous session leaks.
 */
export function resetAllStores() {
  useAuthStore.getState().reset()

  // Reset each data store to empty defaults.
  // IMPORTANT: Always set isLoading: false in each reset
  // to prevent stores from being stuck in loading state.
  // Example:
  // useMessageStore.setState({ conversations: [], messages: [], isLoading: false })
  // useDashboardStore.setState({ stats: emptyStats, isLoading: false, lastFetchedAt: null })
}
```

---

### 3.5 AuthProvider

This is the second most critical file. It is the single orchestration point for auth lifecycle.

```tsx
// src/components/providers/AuthProvider.tsx
import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { resetAllStores } from '@/lib/resetStores'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { authService } from '@/services/authService'

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const ACTIVITY_THROTTLE_MS = 30_000           // 30 seconds

interface AuthProviderProps {
  children: React.ReactNode
}

/**
 * AuthProvider responsibilities:
 *   1. Subscribe to onAuthStateChange (INITIAL_SESSION handles first load)
 *   2. Reset all stores on SIGNED_OUT
 *   3. Handle tab visibility for token refresh
 *   4. Implement inactivity timeout
 *   5. Gate app render on initial auth resolution
 *
 * RULES (violating any of these causes bugs):
 *   - The onAuthStateChange callback MUST be synchronous
 *   - Async work MUST be dispatched via setTimeout
 *   - No separate getSession() or initialize() call
 *   - BrowserRouter MUST be a child of AuthProvider (inside the loading gate)
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const isLoading = useAuthStore((s) => s.isLoading)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const handleAuthEvent = useAuthStore((s) => s.handleAuthEvent)

  // ── 1. Auth state subscription (single source of truth) ────────
  //
  // INITIAL_SESSION fires immediately on subscription, replacing any
  // need for a separate initialize() or getSession() call.
  //
  // The callback is SYNCHRONOUS. Supabase docs explicitly warn:
  //   "Avoid using async functions as callbacks to prevent deadlocks"
  //   "Do not use other Supabase functions directly in the callback;
  //    dispatch them after callback completion using setTimeout"
  //
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // ---- SYNC ZONE — no awaits, no Supabase calls ----

      if (event === 'SIGNED_OUT') {
        resetAllStores()
        return
      }

      // Dispatch async work (profile fetch) outside the callback
      setTimeout(() => {
        handleAuthEvent(event, session)
      }, 0)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [handleAuthEvent])

  // ── 2. Tab visibility → token refresh ──────────────────────────
  //
  // When a tab is backgrounded, browser throttles JS timers. The
  // Supabase access token (default 1 hour) can expire while backgrounded.
  // On refocus, we tell Supabase to immediately check/refresh the token.
  //
  // Without this, API calls after tab-switch fail with 401s, causing
  // pages to get stuck in loading states.
  //
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.startAutoRefresh()
      } else {
        supabase.auth.stopAutoRefresh()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  // ── 3. Inactivity timeout ──────────────────────────────────────
  //
  // Logs out the user after INACTIVITY_TIMEOUT_MS of no mouse/keyboard/
  // touch activity. The timer reset is throttled to avoid performance
  // overhead from high-frequency events like mousemove.
  //
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(0)

  const onTimeout = useCallback(async () => {
    const { session } = useAuthStore.getState()
    if (!session) return
    try {
      await authService.logout()
    } catch {
      // Force-clear even if network call fails
      resetAllStores()
      useAuthStore.setState({
        session: null,
        profile: null,
        isLoading: false,
        isSubmitting: false,
        isAuthenticated: false,
        isEmailVerified: false,
        isVerified: false,
        isAdmin: false,
        isModerator: false,
        isBanned: false,
      })
    }
  }, [])

  const resetTimer = useCallback(() => {
    const now = Date.now()
    if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return
    lastActivityRef.current = now
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(onTimeout, INACTIVITY_TIMEOUT_MS)
  }, [onTimeout])

  useEffect(() => {
    if (!isAuthenticated) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setTimeout(onTimeout, INACTIVITY_TIMEOUT_MS)

    const events: (keyof WindowEventMap)[] = [
      'mousemove', 'keydown', 'touchstart', 'click', 'scroll',
    ]
    for (const evt of events) {
      window.addEventListener(evt, resetTimer, { passive: true })
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const evt of events) {
        window.removeEventListener(evt, resetTimer)
      }
    }
  }, [isAuthenticated, resetTimer, onTimeout])

  // ── 4. Gate app render on initial auth resolution ──────────────
  //
  // isLoading starts as true in the store. It becomes false when
  // handleAuthEvent processes the INITIAL_SESSION event.
  //
  // While true, the BrowserRouter (inside children) is NOT mounted.
  // This prevents layouts/guards from seeing default store values
  // and prematurely redirecting.
  //
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return <>{children}</>
}
```

---

### 3.6 useAuth Hook

```typescript
// src/hooks/useAuth.ts
import { useAuthStore } from '@/stores/authStore'

export const useAuth = () => {
  const store = useAuthStore()

  return {
    // State
    session: store.session,
    profile: store.profile,
    isLoading: store.isLoading,       // for layout/route guards ONLY
    isSubmitting: store.isSubmitting,  // for form buttons ONLY
    error: store.error,
    signupEmail: store.signupEmail,

    // Derived flags
    isAuthenticated: store.isAuthenticated,
    isEmailVerified: store.isEmailVerified,
    isVerified: store.isVerified,
    isAdmin: store.isAdmin,
    isModerator: store.isModerator,
    isBanned: store.isBanned,

    // Actions
    login: store.login,
    signup: store.signup,
    logout: store.logout,
    refreshProfile: store.refreshProfile,
    clearError: store.clearError,
    reset: store.reset,
    handleAuthEvent: store.handleAuthEvent,
  }
}
```

---

### 3.7 App Component (Router Structure)

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
// ... page imports

/**
 * Context-aware root route:
 *   Unauthenticated → public Home (marketing landing)
 *   Authenticated   → redirect to /dashboard
 */
function HomeOrDashboard() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) return <Home />
  return <Navigate to="/dashboard" replace />
}

function App() {
  return (
    // AuthProvider WRAPS BrowserRouter.
    // This is intentional — AuthProvider gates on isLoading,
    // and BrowserRouter must be unmountable during initial load
    // but NEVER during login/signup/logout (those use isSubmitting).
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomeOrDashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            {/* ...other public routes */}
          </Route>

          {/* Dashboard routes (DashboardLayout handles auth checks) */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            {/* ...other dashboard routes */}
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

---

### 3.8 Login Page (Redirect Pattern)

```tsx
// src/pages/Login.tsx
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/constants'

export function Login() {
  const navigate = useNavigate()
  const { login, isSubmitting, isAuthenticated, error, clearError } = useAuth()

  // RULE: Every auth page must redirect if already authenticated.
  // Without this, users see the login form briefly after auth state updates.
  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  const onSubmit = async (data: LoginFormValues) => {
    try {
      await login(data.email, data.password)
      // login() updates session/profile in the store directly,
      // so isAuthenticated is true by the time we get here.
      // navigate() uses the CURRENT (mounted) router — works correctly
      // because login() never set isLoading (which would unmount the router).
      navigate(ROUTES.DASHBOARD)
    } catch {
      // Error is handled by the auth store
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* ...form fields... */}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <Spinner /> : null}
        Sign In
      </Button>
    </form>
  )
}
```

**CRITICAL**: Navigate to `/dashboard` directly, NOT to `/`. Navigating to `/` adds an unnecessary redirect hop through `HomeOrDashboard`.

---

### 3.9 Dashboard Layout (Auth Gate)

```tsx
// src/layouts/DashboardLayout.tsx
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

export function DashboardLayout() {
  const { isAuthenticated, isEmailVerified, isBanned, profile, isLoading } = useAuth()

  // isLoading is only true during initial app boot.
  // It will NOT be true during login/logout because those use isSubmitting.
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (isBanned) return <Navigate to="/banned" replace />
  if (!isEmailVerified) return <Navigate to="/verify-email" replace />
  if (!profile?.postcode) return <Navigate to="/onboarding" replace />

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
```

---

### 3.10 Route Guard Component

```tsx
// src/components/common/RouteGuard.tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

interface RouteGuardProps {
  requireAuth?: boolean
  requireVerified?: boolean
  requireAdmin?: boolean
  allowRejected?: boolean
  children?: React.ReactNode
}

export function RouteGuard({
  requireAuth = false,
  requireVerified = false,
  requireAdmin = false,
  allowRejected = false,
  children,
}: RouteGuardProps) {
  const {
    isAuthenticated, isEmailVerified, isBanned,
    isModerator, profile, isLoading,
  } = useAuth()

  // Only true during initial boot — never during form submissions
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isAuthenticated && isBanned) return <Navigate to="/banned" replace />

  if (requireAuth || requireVerified) {
    if (!isAuthenticated) return <Navigate to="/login" replace />
  }

  if (requireVerified && isAuthenticated) {
    if (!isEmailVerified) return <Navigate to="/verify-email" replace />
    if (!profile?.postcode) return <Navigate to="/onboarding" replace />
    if (!allowRejected && profile.verification_status === 'rejected') {
      return <Navigate to="/onboarding" replace />
    }
  }

  if (requireAdmin && !isModerator) {
    return <Navigate to="/404" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
```

---

## 4. Common Pitfalls & Rules

### 4.1 NEVER: Async `onAuthStateChange` Callback

```typescript
// BAD — causes deadlocks
supabase.auth.onAuthStateChange(async (event, session) => {
  await handleAuthEvent(event, session) // DEADLOCK RISK
})

// GOOD — sync callback, async dispatched outside
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    resetAllStores()
    return
  }
  setTimeout(() => {
    handleAuthEvent(event, session)
  }, 0)
})
```

**Why**: Supabase internally awaits the callback before proceeding. An async callback that calls Supabase functions creates a circular dependency — the callback waits for Supabase, and Supabase waits for the callback. This manifests as the app freezing or getting stuck in loading state, especially on tab refocus when `SIGNED_IN` fires.

### 4.2 NEVER: Set `isLoading = true` in Login/Signup/Logout

```typescript
// BAD — unmounts BrowserRouter, breaks navigate()
login: async (email, password) => {
  set({ isLoading: true }) // AuthProvider shows spinner, BrowserRouter unmounts
  await authService.login(email, password)
  set({ isLoading: false }) // BrowserRouter remounts at /login
  // navigate() from the old component is stale — silently fails
}

// GOOD — isSubmitting only affects form buttons
login: async (email, password) => {
  set({ isSubmitting: true })
  const data = await authService.login(email, password)
  set({ session: data.session, profile, isSubmitting: false, isLoading: false })
  // Router was never unmounted — navigate() works
}
```

**Why**: `AuthProvider` gates the entire app (including `BrowserRouter`) behind `isLoading`. Setting it to `true` during login unmounts the router. When it remounts, `navigate()` references from the old render cycle are stale and silently fail. The user sees the login form with an authenticated Navbar but no redirect.

### 4.3 NEVER: Dual Initialization

```typescript
// BAD — race condition
useEffect(() => { initialize() }, [])      // calls getSession() + profile fetch
useEffect(() => { onAuthStateChange() }, []) // INITIAL_SESSION also fires + profile fetch

// GOOD — single path
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    // INITIAL_SESSION fires immediately — this IS the initialization
    setTimeout(() => handleAuthEvent(event, session), 0)
  })
  return () => subscription.unsubscribe()
}, [handleAuthEvent])
```

**Why**: `INITIAL_SESSION` fires synchronously when `onAuthStateChange` is called. If you ALSO call `getSession()` / `initialize()`, you have two parallel async paths that both set `isLoading`. The loser of the race can set `isLoading: true` after the winner already set it to `false`, permanently blocking the app.

### 4.4 NEVER: Navigate to `/` After Login

```typescript
// BAD — unnecessary redirect hop, can flash wrong page
navigate('/')

// GOOD — direct to destination
navigate('/dashboard')
```

**Why**: `/` renders `HomeOrDashboard` which checks `isAuthenticated` and does a second redirect to `/dashboard`. If auth state hasn't propagated yet, the user briefly sees the Home page. Navigate directly to the destination.

### 4.5 NEVER: Call Supabase Inside `onAuthStateChange`

```typescript
// BAD — called inside the callback
supabase.auth.onAuthStateChange(async (event, session) => {
  const profile = await supabase.from('profiles').select('*')... // INSIDE CALLBACK
})

// GOOD — dispatched outside via setTimeout
supabase.auth.onAuthStateChange((event, session) => {
  setTimeout(async () => {
    const profile = await supabase.from('profiles').select('*')... // OUTSIDE CALLBACK
  }, 0)
})
```

**Why**: Supabase docs: *"Do not use other Supabase functions directly in the callback; dispatch them after callback completion using setTimeout."* The auth client locks during callback execution. Calling Supabase functions creates a lock contention that can hang.

### 4.6 ALWAYS: Handle Tab Visibility

```typescript
useEffect(() => {
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => document.removeEventListener('visibilitychange', onVisibilityChange)
}, [])
```

**Why**: When a tab is backgrounded, browsers throttle JavaScript timers. Supabase's auto-refresh interval may not fire, causing the access token (default 1 hour) to expire. When the user returns to the tab, all API calls fail with 401 until the token is refreshed. `startAutoRefresh()` forces an immediate check and refresh.

### 4.7 ALWAYS: Redirect Authenticated Users Away from Login/Signup

```tsx
// At the top of Login component, before any hooks that depend on form state
if (isAuthenticated) {
  return <Navigate to="/dashboard" replace />
}
```

**Why**: After `onAuthStateChange` fires `SIGNED_IN` (e.g., on tab refocus), the Login page would re-render with `isAuthenticated: true` but not redirect. The user sees the login form with "Go to Dashboard" in the Navbar. This guard ensures immediate redirect.

### 4.8 ALWAYS: Update State Directly in `login()`

```typescript
login: async (email, password) => {
  const data = await authService.login(email, password)
  const session = data.session
  // Fetch profile and set EVERYTHING in one set() call
  set({ session, profile, isSubmitting: false, isLoading: false, ...deriveFlags(session, profile) })
}
```

**Why**: `onAuthStateChange` fires asynchronously via `setTimeout`. If `login()` doesn't update the store directly, there's a window where `navigate()` runs but `isAuthenticated` is still `false`. The dashboard layout would redirect back to login. By setting state directly from the response, navigation works immediately.

---

## 5. Data Flow Diagrams

### 5.1 App Boot (Page Load / Refresh)

```
1. App mounts → AuthProvider renders
2. authStore has isLoading: true (initial state)
3. AuthProvider shows full-screen spinner (BrowserRouter NOT mounted)
4. useEffect subscribes to onAuthStateChange
5. INITIAL_SESSION fires immediately (sync)
6. Callback dispatches handleAuthEvent via setTimeout
7. handleAuthEvent fetches profile, calls set({ isLoading: false, session, profile })
8. AuthProvider re-renders → isLoading is false → renders children (BrowserRouter)
9. Routes render, layouts check isAuthenticated for redirects
```

### 5.2 Login Flow

```
1. User submits login form
2. login() sets isSubmitting: true (router stays mounted)
3. authService.login() calls signInWithPassword
4. Supabase returns session data
5. login() fetches profile
6. login() calls set({ session, profile, isSubmitting: false, isAuthenticated: true })
7. Login component re-renders, sees isAuthenticated: true → <Navigate to="/dashboard">
8. (Meanwhile) onAuthStateChange fires SIGNED_IN → setTimeout → handleAuthEvent
9. handleAuthEvent updates store (no-op, same data) — harmless duplicate
```

### 5.3 Tab Switch (Background → Foreground)

```
1. Tab goes to background → visibilitychange fires → stopAutoRefresh()
2. Time passes, access token may expire
3. Tab comes to foreground → visibilitychange fires → startAutoRefresh()
4. Supabase checks token, refreshes if needed
5. If refreshed: TOKEN_REFRESHED event → handleAuthEvent → updates session
6. If refresh fails: SIGNED_OUT event → resetAllStores() → user redirected to login
7. Either way, no stuck loading state
```

### 5.4 Logout Flow

```
1. User clicks logout
2. logout() sets isSubmitting: true
3. authService.logout() calls signOut()
4. Supabase clears session
5. onAuthStateChange fires SIGNED_OUT (sync callback)
6. resetAllStores() clears all Zustand stores
7. logout() also sets session: null, isSubmitting: false, isAuthenticated: false
8. DashboardLayout re-renders, sees isAuthenticated: false → <Navigate to="/login">
```

---

## 6. Quick-Start Checklist

Use this when setting up auth in a new project:

### Store Setup
- [ ] Create auth store with `isLoading: true` as initial state
- [ ] Add `isSubmitting: boolean` (separate from `isLoading`)
- [ ] `handleAuthEvent()` always sets `isLoading: false`
- [ ] `login()` uses `isSubmitting`, returns session/profile directly from response
- [ ] `signup()` and `logout()` use `isSubmitting`
- [ ] `deriveFlags()` computes all boolean flags from session + profile
- [ ] `reset()` sets both `isLoading: false` and `isSubmitting: false`
- [ ] NO `initialize()` action — `INITIAL_SESSION` handles it

### AuthProvider Setup
- [ ] Subscribes to `onAuthStateChange` in a single `useEffect`
- [ ] Callback is **synchronous** (no `async` keyword)
- [ ] Async work dispatched via `setTimeout(() => ..., 0)`
- [ ] `SIGNED_OUT` calls `resetAllStores()` synchronously in callback
- [ ] Visibility change listener with `startAutoRefresh` / `stopAutoRefresh`
- [ ] Inactivity timeout with throttled activity tracking
- [ ] Gates children on `isLoading` (shows spinner)
- [ ] NO call to `initialize()` or `getSession()`

### Router Setup
- [ ] `BrowserRouter` is a child of `AuthProvider` (inside the loading gate)
- [ ] Public pages wrapped in `MainLayout`
- [ ] Dashboard pages wrapped in `DashboardLayout` (checks `isAuthenticated`)
- [ ] `HomeOrDashboard` component at `/` for context-aware root

### Pages
- [ ] Login page has `if (isAuthenticated) return <Navigate to="/dashboard" replace />`
- [ ] Login page navigates to `/dashboard` directly (not `/`)
- [ ] Login button uses `isSubmitting` for disabled state
- [ ] Signup page uses `isSubmitting` for disabled state
- [ ] All authenticated pages check `isLoading` before rendering content

### Data Stores
- [ ] Each data store has its own `isLoading` (independent of auth `isLoading`)
- [ ] `resetAllStores()` resets every store with `isLoading: false`
- [ ] Dashboard store uses stale-while-revalidate (only shows spinner on first fetch)

---

## 7. Package Versions This Was Tested With

| Package | Version |
|---------|---------|
| `@supabase/supabase-js` | `^2.98.0` |
| `react-router-dom` | `^7.13.0` |
| `zustand` | `^5.x` |
| `react` | `^19.x` |

The `INITIAL_SESSION` event and `startAutoRefresh` / `stopAutoRefresh` methods require Supabase JS v2.39+. If using an older version, you will need to add a separate `getSession()` initialization path (but upgrade is strongly recommended).
