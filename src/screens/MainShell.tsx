import { useState, useEffect } from 'react';
import { Home, Map as MapIcon, Users, MessageSquare, User } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { App as CapacitorApp } from '@capacitor/app';
import { useMessagesStore } from '../stores/messagesStore';
import { useHomeFeedStore } from '../stores/homeFeedStore';
import { useAuthStore } from '../stores/authStore';
import HomeFeed from './HomeFeed';
import MapScreen from './MapScreen';
import VenueFilterScreen from './VenueFilterScreen';
import VenueDetailScreen from './VenueDetailScreen';
import AddVenueScreen from './AddVenueScreen';
import PlayerSearchScreen from './PlayerSearchScreen';
import PlayerProfileScreen from './PlayerProfileScreen';
import ConnectionsListScreen from './ConnectionsListScreen';
import MessagesScreen from './MessagesScreen';
import ChatScreen from './ChatScreen';
import ActivityFeedScreen from './ActivityFeedScreen';
import MatchSchedulingScreen from './MatchSchedulingScreen';
import MatchDetailScreen from './MatchDetailScreen';
import MatchesListScreen from './MatchesListScreen';
import MyProfileScreen from './MyProfileScreen';
import EditProfileScreen from './EditProfileScreen';
import SettingsScreen from './SettingsScreen';

export default function MainShell({
  onNavigate,
  key,
  externalRoute,
}: {
  onNavigate: (screen: string, params?: any) => void;
  key?: string | number;
  externalRoute?: { key: number; screen: string; params?: any } | null;
}) {
  const TAB_ORDER: Record<string, number> = {
    home: 0,
    map: 1,
    players: 2,
    messages: 3,
    profile: 4,
  };

  const [activeTab, setActiveTab] = useState('home');
  const [tabDirection, setTabDirection] = useState(0);
  // Navigation stack — each entry is { screen, params }.
  // Last item = currently visible overlay. Empty = show tabs.
  const [screenStack, setScreenStack] = useState<Array<{ screen: string; params: any }>>([]);
  const [overlayDirection, setOverlayDirection] = useState(1);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const activeScreen = screenStack.length > 0 ? screenStack[screenStack.length - 1].screen : null;
  const screenParams  = screenStack.length > 0 ? screenStack[screenStack.length - 1].params  : null;
  
  const { session } = useAuthStore();
  const unreadMessages = useMessagesStore((s) => s.unreadMessagesCount());
  const unreadNotifs = useHomeFeedStore((s) => s.unreadNotifCount);
  const fetchUnreadNotifs = useHomeFeedStore((s) => s.fetchUnreadCount);

  // Store current user ID globally for messagesStore to access
  useEffect(() => {
    if (session?.user?.id) {
      (globalThis as any).__currentUserId = session.user.id;
      fetchUnreadNotifs(session.user.id);
    }
  }, [session?.user?.id, fetchUnreadNotifs]);

  // Respect system reduced-motion preference for accessibility.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    applyPreference();
    mediaQuery.addEventListener('change', applyPreference);
    return () => mediaQuery.removeEventListener('change', applyPreference);
  }, []);

  const handleNavigate = (screen: string, params?: any) => {
    const OVERLAYS = ['venueFilter', 'venueDetail', 'addVenue', 'playerProfile', 'connectionsList',
      'activityFeed',
      'chat', 'matchScheduling', 'matchDetail', 'matchesList', 'editProfile', 'settings'];
    const TABS = ['home', 'map', 'players', 'messages', 'profile'];

    if (OVERLAYS.includes(screen)) {
      // Push onto the stack so Back returns to the previous overlay (or tabs)
      setOverlayDirection(1);
      setScreenStack(prev => [...prev, { screen, params: params ?? null }]);
    } else if (TABS.includes(screen)) {
      // Switch active tab and close all overlays
      const current = TAB_ORDER[activeTab] ?? 0;
      const next = TAB_ORDER[screen] ?? current;
      setTabDirection(next >= current ? 1 : -1);
      setActiveTab(screen);
      setScreenStack([]);
    } else {
      // Bubble up to App.tsx (e.g. 'notifications')
      onNavigate(screen, params);
    }
  };

  const handleBack = () => {
    // Pop the top overlay — returns to previous overlay or to the active tab
    setOverlayDirection(-1);
    setScreenStack(prev => prev.slice(0, -1));
  };

  // Accept route commands from parent (e.g., notifications overlay tap targets)
  useEffect(() => {
    if (!externalRoute?.screen) return;
    handleNavigate(externalRoute.screen, externalRoute.params);
  }, [externalRoute?.key]);

  // Capacitor Android Hardware Back Button Handler
  useEffect(() => {
    let listener: any = null;

    const setupListener = async () => {
      listener = await CapacitorApp.addListener('backButton', () => {
        if (screenStack.length > 0) {
          // Close top overlay — returns to previous overlay or active tab
          handleBack();
        } else if (activeTab !== 'home') {
          // If on a different tab, return to Home feed
          setTabDirection(-1);
          setActiveTab('home');
        } else {
          // On Home with no overlays — exit the app
          CapacitorApp.exitApp();
        }
      });
    };

    setupListener();

    return () => {
      if (listener) listener.remove();
    };
  }, [screenStack, activeTab]);

  const renderActiveTab = () => {
    if (activeTab === 'home') {
      return <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar"><HomeFeed onNavigate={handleNavigate} /></div>;
    }
    if (activeTab === 'map') {
      // Map tab: no scroll wrapper — native GoogleMap needs to fill the container exactly
      return <div className="absolute inset-0 overflow-hidden"><MapScreen onNavigate={handleNavigate} /></div>;
    }
    if (activeTab === 'players') {
      return <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar"><PlayerSearchScreen onNavigate={handleNavigate} /></div>;
    }
    if (activeTab === 'messages') {
      return <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar"><MessagesScreen onNavigate={handleNavigate} /></div>;
    }
    return <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar"><MyProfileScreen onNavigate={handleNavigate} /></div>;
  };

  const renderOverlayScreen = () => {
    if (activeScreen === 'venueFilter') {
      return <VenueFilterScreen onClose={handleBack} />;
    }
    if (activeScreen === 'venueDetail') {
      return <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar"><VenueDetailScreen onBack={handleBack} venueId={screenParams?.id ?? ''} /></div>;
    }
    if (activeScreen === 'addVenue') {
      return <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar"><AddVenueScreen onBack={handleBack} /></div>;
    }
    if (activeScreen === 'playerProfile') {
      return <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar"><PlayerProfileScreen onBack={handleBack} onNavigate={handleNavigate} playerId={screenParams?.id} /></div>;
    }
    if (activeScreen === 'connectionsList') {
      return <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar"><ConnectionsListScreen onNavigate={handleNavigate} onBack={handleBack} /></div>;
    }
    if (activeScreen === 'activityFeed') {
      return <ActivityFeedScreen onBack={handleBack} onNavigate={handleNavigate} />;
    }
    if (activeScreen === 'chat') {
      return <ChatScreen onBack={handleBack} onNavigate={handleNavigate} conversationId={screenParams?.id} participant={screenParams?.participant} />;
    }
    if (activeScreen === 'matchScheduling') {
      return (
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar">
          <MatchSchedulingScreen
            onBack={handleBack}
            preselectedOpponentId={screenParams?.opponentId}
            onCreated={(id) => {
              // Replace matchScheduling with matchDetail so Back skips the form
              setOverlayDirection(1);
              setScreenStack(prev => [...prev.slice(0, -1), { screen: 'matchDetail', params: { id } }]);
            }}
          />
        </div>
      );
    }
    if (activeScreen === 'matchDetail') {
      return <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar"><MatchDetailScreen onBack={handleBack} onNavigate={handleNavigate} matchId={screenParams?.id} /></div>;
    }
    if (activeScreen === 'matchesList') {
      return <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar"><MatchesListScreen onBack={handleBack} onNavigate={handleNavigate} opponentId={screenParams?.opponentId} opponentName={screenParams?.opponentName} /></div>;
    }
    if (activeScreen === 'editProfile') {
      return <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar"><EditProfileScreen onBack={handleBack} /></div>;
    }
    if (activeScreen === 'settings') {
      return <div className="absolute inset-0 overflow-y-auto overflow-x-hidden no-scrollbar"><SettingsScreen onBack={handleBack} /></div>;
    }
    return null;
  };

  const isMapTab = activeTab === 'map';
  const isSheetOverlay = activeScreen === 'venueFilter';

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] relative overflow-hidden">
      <div className="flex-1 relative w-full h-full overflow-hidden">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: prefersReducedMotion || isMapTab ? 0 : tabDirection >= 0 ? 14 : -14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: prefersReducedMotion || isMapTab ? 0 : tabDirection >= 0 ? -14 : 14 }}
            transition={{
              duration: prefersReducedMotion ? 0.01 : isMapTab ? 0.14 : 0.2,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="absolute inset-0"
          >
            {renderActiveTab()}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence initial={false} custom={overlayDirection}>
          {activeScreen && (
            <motion.div
              key={`${activeScreen}-${screenStack.length}`}
              custom={overlayDirection}
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : isSheetOverlay
                    ? { opacity: 0, y: '14%' }
                    : { opacity: 0, x: overlayDirection > 0 ? '8%' : '-5%' }
              }
              animate={isSheetOverlay ? { opacity: 1, y: '0%' } : { opacity: 1, x: '0%' }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : isSheetOverlay
                    ? { opacity: 0, y: '12%' }
                    : { opacity: 0, x: overlayDirection > 0 ? '-5%' : '8%' }
              }
              transition={{ duration: prefersReducedMotion ? 0.01 : isSheetOverlay ? 0.2 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 z-50"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
                className={`absolute inset-0 pointer-events-none ${isSheetOverlay ? 'bg-black/14' : 'bg-black/10'}`}
              />
              <div className="absolute inset-0">{renderOverlayScreen()}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Bottom Nav */}
      <div className={`absolute bottom-4 sm:bottom-6 left-4 right-4 sm:left-6 sm:right-6 z-50 pb-[env(safe-area-inset-bottom)] transition-opacity duration-200 ${activeScreen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="bg-black/90 backdrop-blur-xl rounded-full px-2 sm:px-4 py-2 sm:py-3 flex justify-between items-center shadow-2xl shadow-black/20 border border-white/10 max-w-md mx-auto">
          <NavItem icon={Home} label="Home" isActive={activeTab === 'home'} onClick={() => handleNavigate('home')} hasBadge={unreadNotifs > 0} />
          <NavItem icon={MapIcon} label="Map" isActive={activeTab === 'map'} onClick={() => handleNavigate('map')} />
          <NavItem icon={Users} label="Players" isActive={activeTab === 'players'} onClick={() => handleNavigate('players')} />
          <NavItem icon={MessageSquare} label="Messages" isActive={activeTab === 'messages'} onClick={() => handleNavigate('messages')} hasBadge={unreadMessages > 0} />
          <NavItem icon={User} label="Profile" isActive={activeTab === 'profile'} onClick={() => handleNavigate('profile')} />
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, isActive, onClick, hasBadge }: any) {
  return (
    <button onClick={onClick} className="relative flex flex-col items-center justify-center w-10 h-10 sm:w-12 sm:h-12 group shrink-0">
      {isActive && (
        <motion.div 
          layoutId="activeTab"
          className="absolute inset-0 bg-white/10 rounded-full"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <div className={`relative flex items-center justify-center transition-colors duration-300 z-10 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
        <Icon size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={isActive ? 2.5 : 2} />
        {hasBadge && (
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-ping rounded-full border-2 border-black" />
        )}
      </div>
    </button>
  );
}
