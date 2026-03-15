import { useEffect, useRef, useCallback, useState } from 'react';
import { Bell, MapPin, Calendar, Users, RotateCcw, Trophy, UserPlus, Star, Clock3, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuthStore } from '../stores/authStore';
import { useHomeFeedStore } from '../stores/homeFeedStore';
import type { MatchItem, ActivityItem } from '../lib/queries/feed';
import homeHeroImage from '../assests/image.png';
import upcomingMatchesImage from '../assests/upcomingMatches.png';
import playersImage from '../assests/players.png';
import logoImage from '../assests/logo.png';

type RecentActivityItem = { kind: 'activity'; time: number; id: string; data: ActivityItem };

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatMatchTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const day = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`;
}

function activityGroupLabel(timestamp: number): string {
  const now = new Date();
  const d = new Date(timestamp);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfToday - (7 * 24 * 60 * 60 * 1000);

  if (timestamp >= startOfToday) return 'Today';
  if (timestamp >= startOfWeek) return 'This Week';
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('en-US', { month: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function HeaderChip({
  label,
  accent,
}: {
  label: string;
  accent: 'neutral' | 'ping';
}) {
  return (
    <span
      className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
        accent === 'ping'
          ? 'bg-ping/15 text-ping-dark border border-ping/25'
          : 'bg-white/75 text-gray-600 border border-white/80'
      }`}
    >
      {label}
    </span>
  );
}

export default function HomeFeed({ onNavigate }: { onNavigate: (screen: string, params?: any) => void }) {
  const profile = useAuthStore((s) => s.profile);
  const {
    matches, activities,
    unreadNotifCount,
    isLoadingMatches, isLoadingFeed, isRefreshing,
    fetchAll, refresh, fetchUnreadCount, subscribeToFeed, unsubscribeFromFeed,
  } = useHomeFeedStore();
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);

  // ── Initial data load ───────────────────────────────────────────────────
  useEffect(() => {
    if (profile?.id) fetchAll(profile.id);
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) fetchUnreadCount(profile.id);
  }, [profile?.id, fetchUnreadCount]);

  // ── Realtime subscription (enabled once feed finishes loading) ──────────
  useEffect(() => {
    if (!profile?.id || isLoadingFeed) return;
    // Derive connected IDs from loaded activities (quick client-side approach)
    const connectedIds = Array.from(
      new Set([profile.id, ...activities.map((a) => a.user_id)])
    );
    subscribeToFeed(profile.id, connectedIds);
    return () => unsubscribeFromFeed();
  }, [profile?.id, isLoadingFeed]);

  // ── Pull-to-refresh ─────────────────────────────────────────────────────
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const pullAllowed = useRef(false);
  const pullIndicatorRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    // Only allow pull-to-refresh if we're at the very top when the finger lands
    pullAllowed.current = (scrollRef.current?.scrollTop ?? 1) <= 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullAllowed.current || isRefreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta <= 0) {
      // Finger moving up — reset any partial pull indicator
      pullDistanceRef.current = 0;
      if (pullIndicatorRef.current) {
        pullIndicatorRef.current.style.transform = 'translateY(0px)';
        pullIndicatorRef.current.style.opacity = '0';
      }
      return;
    }
    pullDistanceRef.current = Math.min(delta * 0.4, 64);
    if (pullIndicatorRef.current) {
      pullIndicatorRef.current.style.transform = `translateY(${pullDistanceRef.current}px)`;
      pullIndicatorRef.current.style.opacity = String(Math.min(pullDistanceRef.current / 48, 1));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (pullAllowed.current && pullDistanceRef.current > 40 && profile?.id && !isRefreshing) {
      refresh(profile.id);
    }
    pullDistanceRef.current = 0;
    pullAllowed.current = false;
    if (pullIndicatorRef.current) {
      pullIndicatorRef.current.style.transform = 'translateY(0px)';
      pullIndicatorRef.current.style.opacity = '0';
    }
  }, [profile?.id, isRefreshing]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const compact = e.currentTarget.scrollTop > 20;
    setIsHeaderCompact(prev => (prev === compact ? prev : compact));
  }, []);

  const upcomingMatches = [...matches].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  );

  const recentActivityItems: RecentActivityItem[] = [
    ...activities.map((a) => ({
      kind: 'activity' as const,
      time: new Date(a.created_at).getTime(),
      id: `activity-${a.id}`,
      data: a,
    })),
  ].sort((a, b) => b.time - a.time);

  const recentActivityPreview = recentActivityItems.slice(0, 8);
  const hasMoreActivity = recentActivityItems.length > recentActivityPreview.length;
  const headerMatchSummary = upcomingMatches.length > 0
    ? `${upcomingMatches.length} upcoming`
    : 'No matches';
  const headerActivitySummary = recentActivityItems.length > 0
    ? `${recentActivityItems.length} updates`
    : 'Feed quiet';
  const headerUnreadSummary = unreadNotifCount > 0
    ? `${unreadNotifCount} unread`
    : 'All read';

  return (
    <div
      ref={scrollRef}
      className="pb-[calc(env(safe-area-inset-bottom)+100px)] min-h-full bg-[#FAFAFA] relative w-full overflow-x-hidden overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onScroll={handleScroll}
    >
      {/* Pull-to-refresh indicator */}
      <div
        ref={pullIndicatorRef}
        className="absolute top-0 left-1/2 -translate-x-1/2 z-20 opacity-0 transition-none pointer-events-none pt-[calc(env(safe-area-inset-top,0px)+1rem)]"
        style={{ transform: 'translateY(0px)', opacity: 0 }}
      >
        <div className="mt-3 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
          <RotateCcw size={18} className={`text-gray-500${isRefreshing ? ' animate-spin' : ''}`} />
        </div>
      </div>
      {/* Background glow */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-ping/5 to-transparent pointer-events-none" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 w-full pb-6"
      >
        {/* App Bar (Sticky + Frosted Glass) */}
        <motion.div 
          variants={itemVariants} 
          className={`px-4 sm:px-6 sticky top-0 z-50 bg-white/72 backdrop-blur-2xl border-b border-white/70 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] transition-[padding,margin] duration-200 ${isHeaderCompact ? 'pt-[calc(env(safe-area-inset-top,0px)+0.55rem)] pb-2.5 mb-4' : 'pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] pb-4 mb-6'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`flex items-center gap-3 ${isHeaderCompact ? 'mb-0.5' : 'mb-1.5'}`}>
                <div className="w-10 h-10 rounded-[12px] bg-white/90 border border-white/80 flex items-center justify-center shrink-0 shadow-sm overflow-hidden p-1.5">
                  <img src={logoImage} alt="PingLink logo" className="w-full h-full object-contain" />
                </div>
                <span className="font-bold text-[23px] tracking-tight text-gray-900">PingLink</span>
              </div>
              <div className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar transition-opacity duration-200 ${isHeaderCompact ? 'opacity-90' : 'opacity-100'}`}>
                <HeaderChip label={headerMatchSummary} accent="neutral" />
                <HeaderChip label={headerActivitySummary} accent="neutral" />
                <HeaderChip label={headerUnreadSummary} accent={unreadNotifCount > 0 ? 'ping' : 'neutral'} />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                onClick={() => onNavigate('notifications')}
                aria-label="View notifications"
                className="relative w-11 h-11 rounded-full border border-white/70 shadow-sm backdrop-blur-md bg-white/80 flex items-center justify-center text-gray-700 hover:text-ping active:bg-white transition-colors shrink-0"
              >
                <Bell size={19} strokeWidth={2.5} />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-ping" />
                )}
              </button>
              <button
                 onClick={() => onNavigate('profile')}
                 aria-label={`View profile for ${profile?.full_name ?? 'user'}`}
                 className="w-11 h-11 rounded-full border border-white/70 shadow-sm bg-white/85 overflow-hidden shrink-0 flex items-center justify-center active:scale-95 transition-transform"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[14px] font-bold text-gray-500">
                    {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Greeting Hero */}
        <motion.div variants={itemVariants} className="px-4 sm:px-6 mb-8">
          <div className="relative overflow-hidden rounded-[24px] min-h-[196px] sm:min-h-[220px] ui-card border-transparent">
            <img
              src={homeHeroImage}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/40 to-black/20" />
            <div className="absolute inset-0 bg-[radial-gradient(120%_95%_at_10%_15%,rgba(255,51,102,0.24),transparent_60%)]" />

            <div className="relative z-10 p-5 sm:p-6 h-full flex flex-col justify-end">
              <p className="text-white/85 text-sm font-semibold tracking-wide mb-1">
                {timeGreeting()}
              </p>
              <h1 className="text-white text-[34px] sm:text-4xl font-semibold tracking-tight leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
                {profile?.full_name?.split(' ')[0] ?? 'Player'}
              </h1>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="px-4 sm:px-6 mb-8 w-full">
          <div className="ui-card p-3.5">
            <div className="px-1 pb-3.5">
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">Quick Actions</p>
            </div>
            <div className="grid grid-cols-5 gap-2.5">
              <FeaturedPlayersAction
                imageSrc={playersImage}
                onClick={() => onNavigate('players')}
              />
              <div className="col-span-2 grid grid-rows-2 gap-2.5 h-[156px] sm:h-[164px]">
                <SecondaryQuickAction
                  icon={MapPin}
                  title="Venues"
                  onClick={() => onNavigate('map')}
                />
                <SecondaryQuickAction
                  icon={Calendar}
                  title="Schedule"
                  onClick={() => onNavigate('matchScheduling')}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Dashboard Sections */}
        <motion.div variants={itemVariants} className="px-4 sm:px-6 w-full space-y-8">
          <section>
            <div className="relative overflow-hidden rounded-[22px] min-h-[162px] sm:min-h-[182px] ui-card border-transparent mb-4">
              <img
                src={upcomingMatchesImage}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/35 to-black/72" />
              <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_8%_18%,rgba(255,51,102,0.24),transparent_58%)]" />

              <div className="relative z-10 h-full p-4 sm:p-5 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-white/90 text-xs font-semibold uppercase tracking-[0.09em]">Upcoming Matches</p>
                  <button
                    onClick={() => onNavigate('connectionsList')}
                    className="h-9 px-3 rounded-full bg-black/30 text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-black/40 active:bg-black/45 transition-colors backdrop-blur-sm"
                  >
                    Players
                    <ChevronRight size={15} className="text-white/90" />
                  </button>
                </div>

                <div>
                  <h2 className="text-[26px] sm:text-[30px] leading-tight font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)] mb-1.5">
                    {upcomingMatches.length > 0
                      ? `${upcomingMatches.length} scheduled match${upcomingMatches.length > 1 ? 'es' : ''}`
                      : 'No upcoming matches yet'}
                  </h2>
                  <p className="text-sm text-white/80 font-medium">
                    {upcomingMatches.length > 0
                      ? 'Stay ready and track your next games.'
                      : 'Challenge players to get your next game on the board.'}
                  </p>
                </div>
              </div>
            </div>

            {isLoadingMatches && upcomingMatches.length === 0 && (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="ui-card p-5 animate-pulse">
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-5 w-20 rounded-full bg-gray-100" />
                      <div className="h-4 w-24 rounded bg-gray-100" />
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-gray-100 shrink-0" />
                        <div className="h-4 w-20 rounded bg-gray-100" />
                      </div>
                      <div className="h-3 w-6 rounded bg-gray-100 mx-auto" />
                      <div className="flex items-center justify-end gap-2 min-w-0">
                        <div className="h-4 w-20 rounded bg-gray-100" />
                        <div className="w-9 h-9 rounded-full bg-gray-100 shrink-0" />
                      </div>
                    </div>
                    <div className="h-4 w-36 rounded bg-gray-100 mb-3" />
                    <div className="pt-3 border-t border-gray-100 flex justify-between">
                      <div className="h-3 w-20 rounded bg-gray-100" />
                      <div className="h-3 w-12 rounded bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoadingMatches && upcomingMatches.length === 0 && (
              <div className="ui-card border-dashed border-gray-300 px-5 py-5">
                <p className="text-sm text-gray-500 font-medium">Start a challenge to see upcoming matches here.</p>
              </div>
            )}

            {upcomingMatches.length > 0 && (
              <div className="space-y-4">
                {upcomingMatches.map((match) => (
                  <MatchCard
                    key={`match-${match.id}`}
                    match={match}
                    onPress={() => onNavigate('matchDetail', { id: match.id })}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-end justify-between mb-4">
              <div>
                <h2 className="text-[20px] font-semibold text-gray-900 tracking-tight mb-1">Recent Activity</h2>
                <p className="text-sm text-gray-500 font-medium">
                  Live updates from your tennis network
                </p>
              </div>
              {recentActivityItems.length > 0 && (
                <button
                  onClick={() => onNavigate('activityFeed')}
                  className="ui-section-link"
                >
                  View all
                  <ChevronRight size={15} className="text-gray-500" />
                </button>
              )}
            </div>

            {isLoadingFeed && recentActivityItems.length === 0 && (
              <div className="ui-card overflow-hidden">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="px-4 sm:px-5 py-3.5 border-b border-gray-100 last:border-b-0 bg-white animate-pulse">
                    <div className="flex items-center gap-3 min-h-[56px]">
                      <div className="w-9 h-9 rounded-full bg-gray-100 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="h-4 w-3/4 rounded bg-gray-100 mb-2" />
                        <div className="h-3 w-24 rounded bg-gray-100" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoadingFeed && !isLoadingMatches && upcomingMatches.length === 0 && recentActivityItems.length === 0 && (
              <EmptyFeedState onNavigate={onNavigate} />
            )}

            {recentActivityPreview.length > 0 && (
              <RecentActivityPanel
                items={recentActivityPreview}
                totalCount={recentActivityItems.length}
                hasMore={hasMoreActivity}
                onViewAll={() => onNavigate('activityFeed')}
                onNavigate={onNavigate}
              />
            )}
          </section>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeaturedPlayersAction({ imageSrc, onClick }: { imageSrc: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Find players"
      className="col-span-3 relative h-[156px] sm:h-[164px] rounded-2xl overflow-hidden border border-gray-200 active:scale-[0.98] transition-transform text-left"
    >
      <img src={imageSrc} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover object-center" />
      <div className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/40 to-black/55" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_95%_at_10%_10%,rgba(255,51,102,0.26),transparent_58%)]" />

      <div className="relative z-10 h-full p-3.5 sm:p-4 flex flex-col justify-between">
        <div />

        <div>
          <h3 className="text-white text-[22px] sm:text-[24px] leading-tight font-semibold tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.22)]">
            Players
          </h3>
          <p className="text-white/85 text-xs sm:text-[13px] font-medium mt-1 inline-flex items-center gap-1.5">
            Find players nearby
            <ChevronRight size={14} className="text-white/90" />
          </p>
        </div>
      </div>
    </button>
  );
}

function SecondaryQuickAction({
  icon: Icon,
  title,
  onClick,
}: {
  icon: any;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-full rounded-2xl border border-gray-200 bg-gray-50/90 hover:bg-gray-100/90 active:bg-gray-100 active:scale-[0.98] transition-all px-3 text-left"
    >
      <div className="h-full flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0">
          <Icon size={17} className="text-gray-700" strokeWidth={2.3} />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-gray-900 leading-tight truncate">{title}</h3>
        </div>
      </div>
    </button>
  );
}

function MatchCard({ match, onPress }: { key?: string; match: MatchItem; onPress: () => void }) {
  const isPending = match.status === 'pending';
  const [day, time] = formatMatchTime(match.scheduled_at).split(',');

  return (
    <button
      onClick={onPress}
      className="ui-card p-5 w-full relative overflow-hidden text-left active:bg-gray-50 hover:bg-gray-50/50 transition-colors group"
    >
      <div className="flex items-center justify-between mb-4">
        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${
            isPending ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
          }`}>
            {isPending ? 'Pending' : 'Confirmed'}
        </span>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-gray-900">{day}</p>
          <p className="text-xs font-medium text-gray-500 mt-0.5">{time?.trim() ?? ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4">
        <MatchPlayerChip player={match.player1} align="left" />
        <span className="text-xs font-black tracking-[0.16em] text-gray-500 text-center">VS</span>
        <MatchPlayerChip player={match.player2} align="right" />
      </div>

      {match.venue_name && (
        <div className="flex items-center gap-1.5 text-gray-600 text-sm font-medium mb-4">
          <MapPin size={16} className="text-gray-500 shrink-0" />
          <span className="truncate">{match.venue_name}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-xs font-semibold ui-text-secondary uppercase tracking-wider">Singles Match</span>
        <ChevronRight size={15} className="text-gray-500" />
      </div>
    </button>
  );
}

function MatchPlayerChip({
  player,
  align,
}: {
  player: MatchItem['player1'];
  align: 'left' | 'right';
}) {
  const isRight = align === 'right';

  return (
    <div className={`flex items-center gap-2 min-w-0 ${isRight ? 'flex-row-reverse text-right' : ''}`}>
      {player.avatar_url ? (
        <img src={player.avatar_url} alt={player.full_name} className="w-9 h-9 rounded-full bg-gray-100 object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
          {player.full_name?.[0] ?? '?'}
        </div>
      )}
      <p className="text-[15px] font-semibold text-gray-900 leading-tight truncate">{player.full_name}</p>
    </div>
  );
}

function activitySummary(item: ActivityItem): {
  icon: React.ReactNode;
  label: string;
} {
  const data = item.data;

  switch (item.activity_type) {
    case 'checked_in':
      return {
        icon: <MapPin size={16} className="text-ping" strokeWidth={2.4} />,
        label: `checked in at ${String(data.venue_name ?? 'a venue')}`,
      };
    case 'connection_made':
      return {
        icon: <UserPlus size={16} className="text-blue-600" strokeWidth={2.4} />,
        label: `connected with ${String(data.other_user_name ?? 'a player')}`,
      };
    case 'match_played':
      return {
        icon: <Trophy size={16} className="text-amber-600" strokeWidth={2.4} />,
        label: `played a match${data.opponent_name ? ` vs ${String(data.opponent_name)}` : ''}`,
      };
    case 'venue_added':
      return {
        icon: <MapPin size={16} className="text-emerald-600" strokeWidth={2.4} />,
        label: `added ${String(data.venue_name ?? 'a venue')}`,
      };
    case 'venue_reviewed':
      return {
        icon: <Star size={16} className="text-amber-500" strokeWidth={2.4} />,
        label: `reviewed ${String(data.venue_name ?? 'a venue')}`,
      };
    case 'achievement_earned':
      return {
        icon: <Trophy size={16} className="text-violet-600" strokeWidth={2.4} />,
        label: `earned ${String(data.achievement_name ?? 'an achievement')}`,
      };
    default:
      return {
        icon: <Clock3 size={16} className="text-gray-500" strokeWidth={2.4} />,
        label: item.activity_type.replace(/_/g, ' '),
      };
  }
}

function RecentActivityPanel({
  items,
  totalCount,
  hasMore,
  onViewAll,
  onNavigate,
}: {
  items: RecentActivityItem[];
  totalCount: number;
  hasMore: boolean;
  onViewAll: () => void;
  onNavigate: (screen: string, params?: any) => void;
}) {
  let lastGroup = '';

  return (
    <div className="ui-card overflow-hidden">
      {items.map((item) => {
        const group = activityGroupLabel(item.time);
        const showGroup = group !== lastGroup;
        lastGroup = group;

        return (
          <div key={item.id}>
            {showGroup && (
              <div className="px-4 sm:px-5 pt-3 pb-1.5">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {group}
                </span>
              </div>
            )}
            <RecentActivityRow
              item={item}
              onNavigate={onNavigate}
            />
          </div>
        );
      })}

      {hasMore && (
        <div className="px-4 sm:px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">
            Showing 8 of {totalCount} activities
          </span>
          <button
            onClick={onViewAll}
            className="ui-section-link h-auto"
          >
            View all
            <ChevronRight size={15} className="text-gray-500" />
          </button>
        </div>
      )}
    </div>
  );
}

function RecentActivityRow({
  item,
  onNavigate,
}: {
  item: RecentActivityItem;
  onNavigate: (screen: string, params?: any) => void;
}) {
  const a = item.data;
  const summary = activitySummary(a);
  const canNavigate =
    (a.activity_type === 'connection_made' && Boolean(a.data.other_user_id))
    || (a.activity_type === 'match_played' && Boolean(a.data.match_id))
    || ((a.activity_type === 'venue_added' || a.activity_type === 'venue_reviewed' || a.activity_type === 'checked_in') && Boolean(a.data.venue_id));

  const handlePress = () => {
    if (a.activity_type === 'connection_made' && a.data.other_user_id) {
      onNavigate('playerProfile', { id: a.data.other_user_id });
      return;
    }
    if (a.activity_type === 'match_played' && a.data.match_id) {
      onNavigate('matchDetail', { id: a.data.match_id });
      return;
    }
    if ((a.activity_type === 'venue_added' || a.activity_type === 'venue_reviewed' || a.activity_type === 'checked_in') && a.data.venue_id) {
      onNavigate('venueDetail', { id: a.data.venue_id });
    }
  };

  const activityLabel = `${a.user_name} ${summary.label}. ${formatTimeAgo(a.created_at)}`;

  return (
    <button
      onClick={canNavigate ? handlePress : undefined}
      disabled={!canNavigate}
      aria-label={activityLabel}
      className={`w-full px-4 sm:px-5 py-3.5 border-b border-gray-100 last:border-b-0 text-left transition-colors${
        canNavigate ? ' active:bg-gray-50 cursor-pointer' : ' cursor-default opacity-95'
      }`}
    >
      <div className="flex items-start gap-3 min-h-[56px]">
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
          {summary.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-900 leading-snug whitespace-normal break-words">
            <span className="font-semibold">{a.user_name}</span>{' '}
            <span className="text-gray-600">{summary.label}</span>
          </p>
          <p className="text-xs ui-text-secondary font-medium mt-0.5">{formatTimeAgo(a.created_at)}</p>
        </div>
      </div>
    </button>
  );
}

function EmptyFeedState({ onNavigate }: { onNavigate: (screen: string) => void }) {
  return (
    <div className="ui-card text-center py-12 px-6 border-dashed border-gray-300">
      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <Users size={28} className="text-gray-400" />
      </div>
      <h3 className="font-semibold text-gray-900 text-base mb-2">Your feed is empty</h3>
      <p className="text-gray-500 text-sm mb-6 leading-relaxed max-w-[220px] mx-auto">
        Connect with players near you to see their matches and activity here.
      </p>
      <button
        onClick={() => onNavigate('players')}
        className="px-6 h-12 bg-ping text-white text-sm font-semibold rounded-xl hover:bg-ping-dark active:scale-[0.98] transition-all flex items-center justify-center mx-auto"
      >
        Find Players
      </button>
    </div>
  );
}
