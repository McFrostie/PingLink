import { useEffect, useState } from 'react';
import { ChevronRight, MapPin, Pencil, Settings, Sparkles, Trophy, Calendar, Target, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useConnectionsStore } from '../stores/connectionsStore';
import { fetchMyMatches } from '../lib/queries/matches';
import {
  fetchPreferredVenues,
  fetchAchievementsWithStatus,
  fetchUserActivity,
  fetchUserAvailability,
} from '../lib/queries/profile';
import type {
  PreferredVenue,
  ProfileActivity,
  AchievementWithStatus,
  AvailabilitySlot,
} from '../lib/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatAvailability(slots: AvailabilitySlot[]): string[] {
  return slots.map((slot) => `${DAYS[slot.day_of_week]} ${slot.time_of_day}`);
}

function formatActivity(activity: ProfileActivity): string {
  switch (activity.activity_type) {
    case 'checked_in':
      return `Checked in at ${String(activity.data.venue_name ?? 'a venue')}`;
    case 'connection_made':
      return `Connected with ${String(activity.data.other_user_name ?? 'another player')}`;
    case 'match_played':
      return `Played a match${activity.data.opponent_name ? ` vs ${String(activity.data.opponent_name)}` : ''}`;
    case 'venue_added':
      return `Added ${String(activity.data.venue_name ?? 'a venue')}`;
    case 'venue_reviewed':
      return `Reviewed ${String(activity.data.venue_name ?? 'a venue')}`;
    case 'achievement_earned':
      return `Earned ${String(activity.data.achievement_name ?? 'an achievement')}`;
    default:
      return activity.activity_type.replace(/_/g, ' ');
  }
}

export default function MyProfileScreen({
  onNavigate,
}: {
  onNavigate: (screen: string, params?: any) => void;
}) {
  const profile = useAuthStore((state) => state.profile);
  const { accepted, fetchAll } = useConnectionsStore();

  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [preferredVenues, setPreferredVenues] = useState<PreferredVenue[]>([]);
  const [recentActivity, setRecentActivity] = useState<ProfileActivity[]>([]);
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ matches: 0, venues: 0 });

  useEffect(() => {
    if (!profile?.id) return;

    let isMounted = true;

    async function load() {
      setIsLoading(true);
      await fetchAll(profile.id);

      const [availabilityData, venuesData, activityData, achievementData, matches, checkins] = await Promise.all([
        fetchUserAvailability(profile.id),
        fetchPreferredVenues(profile.id),
        fetchUserActivity(profile.id, 5),
        fetchAchievementsWithStatus(profile.id),
        fetchMyMatches(profile.id),
        supabase
          .from('user_venue_checkins')
          .select('venue_id', { count: 'exact', head: true })
          .eq('user_id', profile.id),
      ]);

      if (!isMounted) return;

      setAvailability(availabilityData);
      setPreferredVenues(venuesData);
      setRecentActivity(activityData);
      setAchievements(achievementData);
      setStats({
        matches: matches.length,
        venues: checkins.count ?? 0,
      });
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  if (!profile) {
    return null;
  }

  const availabilityLabels = formatAvailability(availability);

  return (
    <div className="min-h-full bg-[#FAFAFA] pb-[calc(env(safe-area-inset-bottom)+100px)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
      <div className="px-5 mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-bold mb-2">Profile</p>
          <h1 className="font-display font-bold text-3xl text-gray-900 tracking-tight">My Profile</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('editProfile')}
            className="w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-700"
          >
            <Pencil size={18} />
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className="w-11 h-11 rounded-full bg-black text-white shadow-sm flex items-center justify-center"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div className="px-5 space-y-5">
        <section className="overflow-hidden rounded-3xl bg-white border border-gray-200 shadow-sm">
          <div className="h-36 bg-gradient-to-br from-black via-gray-800 to-ping/80 relative">
            {profile.cover_url ? (
              <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover opacity-80" />
            ) : null}
          </div>
          <div className="px-5 pb-5 -mt-14 relative">
            <div className="w-28 h-28 rounded-full border-4 border-white shadow-md overflow-hidden bg-gray-100 flex items-center justify-center text-4xl font-bold text-gray-400">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                profile.full_name[0]?.toUpperCase() ?? '?'
              )}
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-bold text-3xl text-gray-900 tracking-tight">{profile.full_name}</h2>
                {profile.skill_level ? (
                  <span className="px-2.5 py-1 rounded-full bg-ping/10 text-ping text-[10px] font-bold uppercase tracking-[0.16em]">
                    {profile.skill_level}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-gray-500 font-medium mt-1">@{profile.username}</p>
              {profile.city ? (
                <div className="flex items-center gap-1.5 text-sm text-gray-500 font-medium mt-3">
                  <MapPin size={15} />
                  <span>{profile.city}</span>
                </div>
              ) : null}
              {profile.bio ? <p className="text-sm leading-6 text-gray-700 mt-4">{profile.bio}</p> : null}
            </div>
          </div>
        </section>

        <section className="flex bg-white rounded-2xl border border-gray-200 shadow-sm divide-x divide-gray-100 overflow-hidden">
          <StatItem label="Connections" value={accepted.length} />
          <StatItem label="Matches" value={stats.matches} onClick={() => onNavigate('matchesList')} />
          <StatItem label="Venues" value={stats.venues} />
        </section>

        {(profile.playing_styles.length > 0 || profile.grips.length > 0 || profile.techniques.length > 0) && (
          <Panel title="Game Profile" icon={Target}>
            <div className="space-y-5">
              {profile.playing_styles.length > 0 ? <TagGroup label="Styles" items={profile.playing_styles} /> : null}
              {profile.grips.length > 0 ? <TagGroup label="Grips" items={profile.grips} /> : null}
              {profile.techniques.length > 0 ? <TagGroup label="Techniques" items={profile.techniques} /> : null}
            </div>
          </Panel>
        )}

        {availabilityLabels.length > 0 ? (
          <Panel title="Availability" icon={Calendar}>
            <div className="flex flex-wrap gap-2">
              {availabilityLabels.map((item) => (
                <span key={item} className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-800 text-sm font-medium capitalize border border-gray-100">
                  {item}
                </span>
              ))}
            </div>
          </Panel>
        ) : null}

        {preferredVenues.length > 0 ? (
          <Panel title="Preferred Venues" icon={MapPin} actionLabel="Edit" onAction={() => onNavigate('editProfile')}>
            <div className="flex flex-col">
              {preferredVenues.map((item, i) => (
                <div key={item.venue_id} className={`flex items-center justify-between py-3 ${i !== preferredVenues.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div>
                    <p className="font-medium text-gray-900">{item.venue?.name ?? 'Unknown Venue'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.venue?.address ?? 'No address available'}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded-lg">★ {(item.venue?.average_rating ?? 0).toFixed(1)}</span>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {achievements.length > 0 ? (
          <Panel title="Achievements" icon={Trophy}>
            <div className="grid grid-cols-2 gap-3">
              {achievements.map((item) => (
                <div 
                  key={item.id} 
                  className={`rounded-xl border p-4 flex flex-col items-center text-center ${
                    item.earned 
                      ? 'border-gray-200 bg-white shadow-sm' 
                      : 'border-gray-100 bg-gray-50/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${
                    item.earned 
                      ? 'bg-amber-100 text-amber-600' 
                      : 'bg-gray-200 text-gray-400'
                  }`}>
                    <Trophy size={18} />
                  </div>
                  <p className={`font-semibold text-sm ${item.earned ? 'text-gray-900' : 'text-gray-500'}`}>
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.description}</p>
                  {item.earned && item.earned_at && (
                    <p className="text-[10px] font-bold text-amber-600 mt-3 uppercase tracking-wider">
                      Earned {new Date(item.earned_at).toLocaleDateString()}
                    </p>
                  )}
                  {!item.earned && (
                    <p className="text-[10px] font-bold text-gray-400 mt-3 uppercase tracking-wider">
                      Locked
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        <Panel title="Recent Activity" icon={Activity}>
          {isLoading ? (
            <div className="text-sm text-gray-400 font-medium py-2">Loading activity...</div>
          ) : recentActivity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              Your activity will appear here as you connect, check in, and play.
            </div>
          ) : (
            <div className="space-y-0 pt-2">
              {recentActivity.map((activity, i) => (
                <div key={activity.id} className="flex items-start gap-4 relative">
                  {i !== recentActivity.length - 1 && (
                    <div className="absolute left-5 top-10 bottom-[-8px] w-px bg-gray-200"></div>
                  )}
                  <div className="w-10 h-10 rounded-full bg-ping/5 text-ping flex items-center justify-center shrink-0 z-10 border-2 border-white">
                    <Sparkles size={16} />
                  </div>
                  <div className="pb-6 pt-1.5 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-snug">{formatActivity(activity)}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(activity.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <button
          onClick={() => onNavigate('editProfile')}
          className="w-full rounded-2xl bg-gray-900 active:bg-gray-800 text-white px-5 py-4 flex items-center justify-center gap-2 font-medium shadow-[0_4px_14px_rgb(0,0,0,0.1)] transition-all"
        >
          <span>Edit Profile Details</span>
          <ChevronRight size={18} className="opacity-70" />
        </button>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
  actionLabel,
  onAction,
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={20} className="text-gray-400" />}
          <h3 className="font-semibold text-lg text-gray-900">{title}</h3>
        </div>
        {actionLabel && onAction ? (
          <button onClick={onAction} className="text-sm font-medium text-ping hover:text-ping/80 transition-colors">
            {actionLabel}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function TagGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2.5">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="px-3 py-1.5 rounded-[10px] bg-gray-50 border border-gray-200 text-[13px] font-medium text-gray-700 capitalize">
            {item.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatItem({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center py-4 px-2 ${onClick ? 'hover:bg-gray-50 transition-colors active:bg-gray-100 cursor-pointer' : ''}`}
    >
      <span className="font-semibold text-2xl text-gray-900">{value}</span>
      <span className="text-[11px] font-medium text-gray-500 mt-1 uppercase tracking-wider">{label}</span>
    </Component>
  );
}