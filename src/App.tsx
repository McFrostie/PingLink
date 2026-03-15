// src/App.tsx
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from './stores/authStore';
import type { AuthScreen } from './lib/types';

// Screens
import Splash from './screens/Splash';
import LoadingScreen from './components/LoadingScreen';
import Onboarding from './screens/Onboarding';
import Login from './screens/Login';
import Register from './screens/Register';
import ForgotPassword from './screens/ForgotPassword';
import ProfileSetup from './screens/ProfileSetup';
import MainShell from './screens/MainShell';
import Notifications from './screens/Notifications';
import type { Notification } from './lib/queries/notifications';
import { getNotificationTarget } from './lib/queries/notifications';

const ONBOARDING_KEY = 'pl_onboarding_seen';

export default function App() {
  // Splash always plays first — this is a visual gate, not an auth gate
  const [splashDone, setSplashDone] = useState(false);

  // Onboarding is shown once ever, persisted in localStorage
  // useState with initialiser so it's only read once at mount
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) === '1'
  );

  // Sub-navigation within the unauthenticated auth flow
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');

  // Notifications overlay state (lives outside MainShell so it can slide over it)
  const [showNotifications, setShowNotifications] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [externalRoute, setExternalRoute] = useState<{ key: number; screen: string; params?: any } | null>(null);

  // Auth state from Zustand store
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const profile = useAuthStore((s) => s.profile);
  // Used as the onComplete callback for ProfileSetup — re-fetches profile
  // after the DB write so routing reacts to setup_complete = true
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  // ── Initialization ────────────────────────────────────────────────────────

  useEffect(() => {
    // Configure true fullscreen edge-to-edge drawing on mobile devices
    if (Capacitor.isNativePlatform()) {
      const configureStatusBar = async () => {
        try {
          await StatusBar.setOverlaysWebView({ overlay: true });
          await StatusBar.setStyle({ style: Style.Dark });
          // resizeOnFullScreen is set in capacitor.config.ts.
          // KeyboardResize.Body lets the <body> shrink when the keyboard opens,
          // which is the industry standard for Capacitor chat apps.
          await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
          await Keyboard.setScroll({ isDisabled: true });
        } catch (e) {
          console.error('Failed to configure status bar or keyboard:', e);
        }
      };
      configureStatusBar();
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    applyPreference();
    mediaQuery.addEventListener('change', applyPreference);
    return () => mediaQuery.removeEventListener('change', applyPreference);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setHasSeenOnboarding(true);
    setAuthScreen('login');
  };

  const handleNavigate = (screen: string, params?: any) => {
    if (screen === 'notifications') {
      setShowNotifications(true);
    } else if (screen === 'playerProfile' || screen === 'matchDetail' || screen === 'venueDetail' || screen === 'chat') {
      // These are MainShell overlays - we need to pass through
      // This will be handled by the NotificationNavigate handler below
    }
  };

  const handleNotifNavigate = (notification: Notification) => {
    const target = getNotificationTarget(notification);
    setShowNotifications(false);
    if (!target) return;
    // Wait a tick for the overlay to close, then route inside MainShell.
    setTimeout(() => {
      setExternalRoute({ key: Date.now(), screen: target.screen, params: target.params });
    }, 100);
  };

  // ── Routing logic (evaluated top-to-bottom, first match wins) ─────────────

  const renderScreen = () => {
    // 1. Splash always plays first on every cold start
    if (!splashDone) {
      return (
        <Splash
          key="splash"
          onComplete={() => setSplashDone(true)}
        />
      );
    }

    // 2. Post-splash: if auth hasn't resolved yet, show brief loading screen
    //    In practice this is nearly instant — INITIAL_SESSION fires < 100ms
    if (isLoading) {
      return <LoadingScreen key="loading" />;
    }

    // 3. First install: show onboarding slides
    if (!hasSeenOnboarding) {
      return (
        <Onboarding
          key="onboarding"
          onComplete={handleOnboardingComplete}
        />
      );
    }

    // 4. Not authenticated: show auth flow
    if (!isAuthenticated) {
      if (authScreen === 'register') {
        return (
          <Register
            key="register"
            onBack={() => setAuthScreen('login')}
            onRegister={() => setAuthScreen('login')}
          />
        );
      }
      if (authScreen === 'forgot-password') {
        return (
          <ForgotPassword
            key="forgot-password"
            onBack={() => setAuthScreen('login')}
          />
        );
      }
      // Default: login
      return (
        <Login
          key="login"
          onLogin={() => {/* routing handled by isAuthenticated flip */}}
          onRegister={() => setAuthScreen('register')}
          onForgotPassword={() => setAuthScreen('forgot-password')}
        />
      );
    }

    // 5. Authenticated but hasn't completed profile setup wizard.
    //
    // WHY IS THIS SAFE WITHOUT AN EMAIL-VERIFIED GUARD?
    // When Supabase email confirmation is ON:
    //   - signUp() returns data.session = null (no session until verified)
    //   - Register.tsx shows "Check your email" — user is NOT authenticated yet
    //   - isAuthenticated stays false → user cannot reach this branch
    //   - Only after clicking the email link does Supabase fire SIGNED_IN
    //     with a real session, making isAuthenticated flip to true
    //   - Profile is ALWAYS written while the user holds a confirmed session ✅
    // When email confirmation is OFF:
    //   - Immediate session on signup → goes straight here → profile written ✅
    //
    // ProfileSetup handles its own Supabase writes internally (see Task 15).
    // When done, it calls onComplete → refreshProfile() re-fetches the profile.
    // If profile.setup_complete = true comes back, routing moves to MainShell.
    if (!profile?.setup_complete) {
      return (
        <ProfileSetup
          key="profile-setup"
          onComplete={refreshProfile}
        />
      );
    }

    // 6. Fully authenticated + setup complete: show the app
    return (
      <>
        <MainShell
          key="home"
          onNavigate={handleNavigate}
          externalRoute={externalRoute}
        />
        <AnimatePresence initial={false}>
          {showNotifications && (
            <motion.div
              key="notifications"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: '8%' }}
              animate={{ opacity: 1, x: '0%' }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: '6%' }}
              transition={{ duration: prefersReducedMotion ? 0.01 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 z-[110]"
            >
              <Notifications
                onBack={() => {
                  setShowNotifications(false);
                  // Refresh unread count when closing notifications
                  const userId = profile?.id;
                  if (userId) {
                    import('./stores/homeFeedStore').then(({ useHomeFeedStore }) => {
                      useHomeFeedStore.getState().fetchUnreadCount(userId);
                    });
                  }
                }}
                onNavigate={handleNotifNavigate}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  };

  return (
    <div className="flex items-center justify-center h-full bg-gray-100 w-full overflow-hidden">
      {/* Mobile container */}
      <div
        className="w-full h-full sm:max-w-md sm:h-[850px] sm:max-h-[90vh] sm:rounded-3xl sm:border-4 sm:border-black sm:shadow-2xl overflow-hidden relative bg-white flex flex-col"
      >
        <AnimatePresence mode="wait">
          {renderScreen()}
        </AnimatePresence>
      </div>
    </div>
  );
}
