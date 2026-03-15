import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock3, MapPin, Star, Trophy, UserPlus } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { fetchActivityFeed, type ActivityItem } from '../lib/queries/feed';

const PAGE_SIZE = 30;

type ActivityFilter = 'all' | 'matches' | 'connections' | 'venues';

const FILTERS: Array<{ key: ActivityFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'matches', label: 'Matches' },
  { key: 'connections', label: 'Connections' },
  { key: 'venues', label: 'Venues' },
];

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function activityGroupLabel(iso: string): string {
  const timestamp = new Date(iso).getTime();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfToday - (7 * 24 * 60 * 60 * 1000);
  const d = new Date(timestamp);

  if (timestamp >= startOfToday) return 'Today';
  if (timestamp >= startOfWeek) return 'This Week';
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('en-US', { month: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getActivityMeta(item: ActivityItem): {
  icon: React.ReactNode;
  label: string;
  target: { screen: string; params?: any } | null;
} {
  const data = item.data;

  switch (item.activity_type) {
    case 'checked_in':
      return {
        icon: <MapPin size={14} className="text-ping" strokeWidth={2.4} />,
        label: `checked in at ${String(data.venue_name ?? 'a venue')}`,
        target: data.venue_id ? { screen: 'venueDetail', params: { id: data.venue_id } } : null,
      };
    case 'connection_made':
      return {
        icon: <UserPlus size={14} className="text-blue-600" strokeWidth={2.4} />,
        label: `connected with ${String(data.other_user_name ?? 'a player')}`,
        target: data.other_user_id ? { screen: 'playerProfile', params: { id: data.other_user_id } } : null,
      };
    case 'match_played':
      return {
        icon: <Trophy size={14} className="text-amber-600" strokeWidth={2.4} />,
        label: `played a match${data.opponent_name ? ` vs ${String(data.opponent_name)}` : ''}`,
        target: data.match_id ? { screen: 'matchDetail', params: { id: data.match_id } } : null,
      };
    case 'venue_added':
      return {
        icon: <MapPin size={14} className="text-emerald-600" strokeWidth={2.4} />,
        label: `added ${String(data.venue_name ?? 'a venue')}`,
        target: data.venue_id ? { screen: 'venueDetail', params: { id: data.venue_id } } : null,
      };
    case 'venue_reviewed':
      return {
        icon: <Star size={14} className="text-amber-500" strokeWidth={2.4} />,
        label: `reviewed ${String(data.venue_name ?? 'a venue')}`,
        target: data.venue_id ? { screen: 'venueDetail', params: { id: data.venue_id } } : null,
      };
    case 'achievement_earned':
      return {
        icon: <Trophy size={14} className="text-violet-600" strokeWidth={2.4} />,
        label: `earned ${String(data.achievement_name ?? 'an achievement')}`,
        target: null,
      };
    default:
      return {
        icon: <Clock3 size={14} className="text-gray-500" strokeWidth={2.4} />,
        label: item.activity_type.replace(/_/g, ' '),
        target: null,
      };
  }
}

export default function ActivityFeedScreen({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate: (screen: string, params?: any) => void;
}) {
  const profile = useAuthStore((s) => s.profile);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadPage = async (offset: number, append: boolean) => {
    if (!profile?.id) return;
    if (append) setIsLoadingMore(true);
    else setIsLoadingInitial(true);

    try {
      const page = await fetchActivityFeed(profile.id, PAGE_SIZE, undefined, offset);
      setHasMore(page.length === PAGE_SIZE);
      setItems((prev) => (append ? [...prev, ...page] : page));
    } finally {
      if (append) setIsLoadingMore(false);
      else setIsLoadingInitial(false);
    }
  };

  useEffect(() => {
    if (!profile?.id) return;

    loadPage(0, false);
  }, [profile?.id]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items;
    if (activeFilter === 'matches') {
      return items.filter((i) => i.activity_type === 'match_played');
    }
    if (activeFilter === 'connections') {
      return items.filter((i) => i.activity_type === 'connection_made');
    }
    return items.filter((i) => i.activity_type === 'checked_in' || i.activity_type === 'venue_added' || i.activity_type === 'venue_reviewed');
  }, [items, activeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const item of filteredItems) {
      const key = activityGroupLabel(item.created_at);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filteredItems]);

  return (
    <div className="absolute inset-0 z-[90] bg-[#FAFAFA] flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-white flex items-center justify-between shrink-0 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 border border-gray-100 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display font-bold text-xl text-gray-900">Recent Activity</h1>
            <p className="text-xs text-gray-500 font-medium">Live updates from your network</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`h-9 px-3.5 rounded-full text-sm font-medium border whitespace-nowrap transition-colors ${
                activeFilter === filter.key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 active:bg-gray-50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {isLoadingInitial ? (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[68px] animate-pulse border-b border-gray-100 last:border-b-0 bg-white" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock3 size={24} className="text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base mb-2">No activity yet</h3>
            <p className="text-sm text-gray-500">No entries for this filter yet.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {grouped.map(([groupLabel, groupItems]) => (
                <div key={groupLabel}>
                  <div className="px-4 sm:px-5 py-2 border-y border-gray-100 bg-gray-50/60 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {groupLabel}
                  </div>
                  {groupItems.map((item) => {
                    const meta = getActivityMeta(item);
                    const Tag = meta.target ? 'button' : 'div';
                    return (
                      <Tag
                        key={item.id}
                        onClick={meta.target ? () => onNavigate(meta.target!.screen, meta.target!.params) : undefined}
                        className={`w-full px-4 sm:px-5 py-3.5 border-b border-gray-100 last:border-b-0 text-left transition-colors ${
                          meta.target ? 'active:bg-gray-50 cursor-pointer' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3 min-h-[56px]">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                            {meta.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900 leading-snug whitespace-normal break-words">
                              <span className="font-semibold">{item.user_name}</span>{' '}
                              <span className="text-gray-600">{meta.label}</span>
                            </p>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">{formatTimeAgo(item.created_at)}</p>
                          </div>
                        </div>
                      </Tag>
                    );
                  })}
                </div>
              ))}
            </div>

            {hasMore && (
              <button
                onClick={() => loadPage(items.length, true)}
                disabled={isLoadingMore}
                className="mt-4 w-full h-11 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 active:bg-gray-50 disabled:opacity-60"
              >
                {isLoadingMore ? 'Loading more...' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
