import { useState, useEffect } from 'react';
import { ArrowLeft, MoreVertical, MapPin, UserPlus, MessageSquare, Trophy, Check, Swords } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useConnectionsStore } from '../stores/connectionsStore';
import { getOrCreateConversation } from '../lib/queries/messages';
import { fetchMyMatches } from '../lib/queries/matches';
import {
  fetchPreferredVenues,
  fetchProfileById,
  fetchUserActivity,
  fetchUserAvailability,
} from '../lib/queries/profile';
import type { AvailabilitySlot, PreferredVenue, Profile, ProfileActivity } from '../lib/types';

// ─── Loading skeleton ──────────────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <div className="min-h-full bg-gray-50 flex flex-col pt-[calc(env(safe-area-inset-top,0px))]">
      <div className="h-48 w-full bg-gray-200 animate-pulse" />
      <div className="px-4 sm:px-6 -mt-14">
        <div className="w-28 h-28 rounded-full bg-gray-200 border-4 border-gray-50 mb-4 animate-pulse" />
        <div className="h-7 w-44 bg-gray-200 rounded-full mb-2 animate-pulse" />
        <div className="h-4 w-24 bg-gray-200 rounded-full mb-2 animate-pulse" />
        <div className="h-4 w-32 bg-gray-200 rounded-full mb-6 animate-pulse" />
        <div className="h-20 w-full bg-gray-200 rounded-2xl mb-6 animate-pulse" />
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
          <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ─── Section panel wrapper ─────────────────────────────────────────────────
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-4">
      <h2 className="text-sm font-bold text-gray-700 tracking-tight mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function PlayerProfileScreen({
  onBack,
  onNavigate,
  playerId,
}: {
  onBack: () => void;
  onNavigate: (screen: string, params?: any) => void;
  playerId: string;
}) {
  const { profile: myProfile } = useAuthStore();
  const { send, accepted, pending, sent } = useConnectionsStore();

  const [playerProfile, setPlayerProfile] = useState<Profile | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [preferredVenues, setPreferredVenues] = useState<PreferredVenue[]>([]);
  const [recentActivity, setRecentActivity] = useState<ProfileActivity[]>([]);
  const [stats, setStats] = useState({ connections: 0, matches: 0, venues: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!playerId) return;

    async function fetchData() {
      setIsLoading(true);
      const [profileData, availData, prefData, activityData, connCount, matches, checkinCount] = await Promise.all([
        fetchProfileById(playerId),
        fetchUserAvailability(playerId),
        fetchPreferredVenues(playerId),
        fetchUserActivity(playerId, 3),
        supabase.from('connections').select('id', { count: 'exact', head: true }).or(`requester_id.eq.${playerId},addressee_id.eq.${playerId}`).eq('status', 'accepted'),
        fetchMyMatches(playerId),
        supabase.from('user_venue_checkins').select('venue_id', { count: 'exact', head: true }).eq('user_id', playerId),
      ]);

      if (profileData) setPlayerProfile(profileData);
      setAvailability(availData);
      setPreferredVenues(prefData);
      setRecentActivity(activityData);

      setStats({
        connections: connCount.count ?? 0,
        matches: matches.length,
        venues: checkinCount.count ?? 0,
      });

      setIsLoading(false);
    }

    fetchData();
  }, [playerId]);

  const connectionStatus = (() => {
    if (accepted.some(c => c.other_profile.id === playerId)) return 'connected';
    if (sent.some(c => c.other_profile.id === playerId)) return 'sent';
    if (pending.some(c => c.other_profile.id === playerId)) return 'pending';
    return 'none';
  })();

  const handleConnect = async () => {
    if (connectionStatus !== 'none' || !myProfile?.id) return;
    await send(myProfile.id, playerId);
  };

  const handleMessage = async () => {
    if (!myProfile?.id || !playerProfile) return;
    setIsLoading(true);
    const convId = await getOrCreateConversation(myProfile.id, playerId);
    setIsLoading(false);
    if (convId) {
      onNavigate('chat', { id: convId, participant: playerProfile });
    }
  };

  if (isLoading) return <ProfileSkeleton />;

  if (!playerProfile) {
    return (
      <div className="min-h-full bg-gray-50 flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-1">
          <UserPlus size={22} className="text-gray-400" />
        </div>
        <p className="text-gray-900 font-semibold text-base">Profile not found</p>
        <p className="text-gray-500 text-sm text-center">This player may have removed their account.</p>
        <button
          onClick={onBack}
          className="mt-2 h-11 px-6 rounded-full bg-gray-900 text-white text-sm font-medium active:scale-95 transition-transform"
        >
          Go back
        </button>
      </div>
    );
  }

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const availStrings = availability.map(a => `${days[a.day_of_week]} ${a.time_of_day}`);

  // Calculate enough padding to ensure the scrollable content always clears the fixed bottom bar
  // The bottom bar has up to 2 rows of 56px buttons + padding + gaps, totaling ~160px height.
  const paddingBottomClass = myProfile?.id !== playerId 
    ? 'pb-[calc(env(safe-area-inset-bottom,0px)+180px)]' 
    : 'pb-[calc(env(safe-area-inset-bottom,0px)+40px)]';

  return (
    <div className={`min-h-full bg-gray-50 relative w-full overflow-y-auto overflow-x-hidden ${paddingBottomClass}`}>

      {/* ── Cover + nav ── */}
      <div className="relative h-56 w-full bg-gray-200">
        {playerProfile.cover_url ? (
          <img src={playerProfile.cover_url} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-gray-800 to-gray-600" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />

        <div className="absolute top-0 left-0 w-full pt-[calc(env(safe-area-inset-top,0px)+1rem)] px-4 sm:px-6 z-20 flex justify-between items-center">
          <button
            onClick={onBack}
            className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/30 transition-colors active:scale-95"
          >
            <ArrowLeft size={24} />
          </button>
          <button className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/30 transition-colors active:scale-95">
            <MoreVertical size={24} />
          </button>
        </div>
      </div>

      {/* ── Profile content ── */}
      <div className="relative z-30 -mt-16 px-4 sm:px-6 max-w-3xl mx-auto">

        {/* Avatar */}
        <div className="mb-4">
          {playerProfile.avatar_url ? (
            <img
              src={playerProfile.avatar_url}
              alt={playerProfile.full_name}
              className="w-32 h-32 rounded-full border-4 border-gray-50 object-cover bg-white shadow-sm"
            />
          ) : (
            <div className="w-32 h-32 rounded-full border-4 border-gray-50 bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-5xl shadow-sm">
              {playerProfile.full_name[0]?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>

        {/* Name + meta */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-1.5">
            <h1 className="font-display font-bold text-[32px] leading-tight text-gray-900 tracking-tight">{playerProfile.full_name}</h1>
            {playerProfile.skill_level && (
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold">
                {playerProfile.skill_level}
              </span>
            )}
          </div>
          <p className="text-gray-600 text-base mb-2 font-medium">@{playerProfile.username}</p>
          {playerProfile.city && (
            <div className="flex items-center gap-2 text-gray-600 text-sm font-medium">
              <MapPin size={16} className="text-gray-400" />
              {playerProfile.city}
            </div>
          )}
          {playerProfile.bio && (
            <p className="mt-4 text-gray-700 text-[15px] leading-relaxed max-w-prose">{playerProfile.bio}</p>
          )}
        </div>

        {/* ── Stats row ── */}
        <div className="flex items-center justify-between bg-white rounded-2xl px-2 py-4 mb-6 border border-gray-200 divide-x divide-gray-100">
          <div className="text-center flex-1">
            <div className="font-display font-bold text-2xl text-gray-900">{stats.connections}</div>
            <div className="text-sm font-semibold text-gray-500 mt-1">Connections</div>
          </div>
          <button
            onClick={() => onNavigate('matchesList', { opponentId: playerId, opponentName: playerProfile?.full_name })}
            className="text-center flex-1 hover:bg-gray-50 transition-colors active:scale-95 py-2 mx-1 rounded-xl"
          >
            <div className="font-display font-bold text-2xl text-gray-900">{stats.matches}</div>
            <div className="text-sm font-semibold text-gray-500 mt-1">Matches</div>
          </button>
          <div className="text-center flex-1">
            <div className="font-display font-bold text-2xl text-gray-900">{stats.venues}</div>
            <div className="text-sm font-semibold text-gray-500 mt-1">Venues</div>
          </div>
        </div>

        {/* ── Detail sections ── */}
        <div className="space-y-4">

          {(playerProfile.playing_styles?.length ?? 0) > 0 && (
            <Panel title="Playing Style">
              <div className="flex flex-wrap gap-2.5">
                {playerProfile.playing_styles?.map(style => (
                  <span key={style} className="px-4 py-2 bg-gray-100/70 rounded-xl text-[15px] font-medium text-gray-800 capitalize">
                    {style.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {availStrings.length > 0 && (
            <Panel title="Availability">
              <div className="flex flex-wrap gap-2.5">
                {availStrings.map(time => (
                  <div key={time} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-[15px] font-medium text-gray-800 capitalize shadow-sm">
                    {time}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {preferredVenues.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
              <div className="px-5 sm:px-6 pt-5 pb-3">
                <h2 className="text-sm font-bold text-gray-700 tracking-tight">Preferred Venues</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {preferredVenues.map((venue) => (
                  <div key={venue.venue_id} className="flex items-center gap-4 px-5 sm:px-6 py-4">
                    <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                      <MapPin size={20} />
                    </div>
                    <span className="font-semibold text-gray-900 text-[15px]">{venue.venue?.name ?? 'Unknown venue'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentActivity.length > 0 && (
            <Panel title="Recent Activity">
              <div className="space-y-6">
                {recentActivity.map(activity => {
                  let text = '';
                  let icon = <MapPin size={18} className="text-gray-500" />;
                  if (activity.activity_type === 'checked_in') {
                    text = `Checked in at ${activity.data?.venue_name}`;
                  } else if (activity.activity_type === 'match_played') {
                    text = 'Played a match';
                    icon = <Trophy size={18} className="text-gray-500" />;
                  } else if (activity.activity_type === 'connection_made') {
                    text = `Connected with ${activity.data?.other_user_name}`;
                    icon = <UserPlus size={18} className="text-gray-500" />;
                  } else {
                    text = activity.activity_type.replace(/_/g, ' ');
                  }
                  const timeStr = new Date(activity.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <div key={activity.id} className="flex gap-4 items-start">
                      <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                        {icon}
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-[15px] text-gray-900 font-medium capitalize">{text}</p>
                        <p className="text-sm text-gray-500 mt-1">{timeStr}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

        </div>
      </div>

      {/* ── Fixed Bottom Actions ── */}
      {myProfile?.id !== playerId && (
        <div className="fixed bottom-0 left-0 w-full px-4 sm:px-6 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] bg-white/85 backdrop-blur-xl border-t border-gray-200 z-50">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="rounded-[24px] border border-gray-200 bg-gray-100/80 p-2.5 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]">
              <div className="flex gap-2.5">
              <button
                onClick={handleConnect}
                disabled={connectionStatus !== 'none'}
                className={`flex-1 h-14 rounded-[18px] font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] border ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : connectionStatus === 'sent'
                    ? 'bg-gray-50 text-gray-500 border-gray-200'
                    : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]'
                }`}
              >
                {connectionStatus === 'connected' ? <Check size={20} /> : <UserPlus size={20} />}
                {connectionStatus === 'connected'
                  ? 'Connected'
                  : connectionStatus === 'sent'
                  ? 'Request Sent'
                  : 'Connect'}
              </button>
              <button
                onClick={handleMessage}
                className="flex items-center justify-center gap-2.5 flex-1 h-14 rounded-[18px] bg-white border border-gray-300 font-semibold text-[15px] text-gray-900 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] transition-all active:scale-[0.98] hover:bg-gray-50"
              >
                <MessageSquare size={20} />
                Message
              </button>
            </div>
            </div>
            {connectionStatus === 'connected' && (
              <button
                onClick={() => onNavigate('matchScheduling', { opponentId: playerId })}
                className="w-full h-14 rounded-[18px] bg-gray-900 text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 hover:bg-black shadow-sm active:scale-[0.98] transition-all"
              >
                <Swords size={20} />
                Challenge to Match
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
