import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, MapPin, Trophy, Clock, XCircle, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { fetchMyMatches } from '../lib/queries/matches';
import type { Match } from '../lib/queries/matches';

type MatchTab = 'upcoming' | 'past';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle },
  completed: { label: 'Completed', color: 'text-blue-700', bg: 'bg-blue-50', icon: Trophy },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50', icon: XCircle },
};

function formatMatchDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatMatchTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MatchesListScreen({
  onBack,
  onNavigate,
  opponentId,
  opponentName,
}: {
  onBack: () => void;
  onNavigate: (screen: string, params?: any) => void;
  opponentId?: string;
  opponentName?: string;
}) {
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<MatchTab>('upcoming');
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    async function load() {
      setIsLoading(true);
      const allMatches = await fetchMyMatches(profile.id);
      // Filter by opponent if specified
      const filteredMatches = opponentId
        ? allMatches.filter(m => m.player1_id === opponentId || m.player2_id === opponentId)
        : allMatches;
      setMatches(filteredMatches);
      setIsLoading(false);
    }

    load();
  }, [profile?.id, opponentId]);

  const now = new Date();
  
  const upcomingMatches = matches
    .filter(m => {
      const matchDate = new Date(m.scheduled_at);
      return (m.status === 'pending' || m.status === 'confirmed') && matchDate >= now;
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const pastMatches = matches
    .filter(m => {
      const matchDate = new Date(m.scheduled_at);
      return m.status === 'completed' || m.status === 'cancelled' || matchDate < now;
    })
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  const currentMatches = activeTab === 'upcoming' ? upcomingMatches : pastMatches;

  return (
    <div className="absolute inset-0 bg-[#FAFAFA] flex flex-col overflow-hidden z-[100]">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 transition-all"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="font-display font-bold text-xl text-gray-900">
              {opponentName ? `Matches with ${opponentName}` : 'My Matches'}
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'upcoming'
                ? 'bg-ping text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
            }`}
          >
            Upcoming ({upcomingMatches.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'past'
                ? 'bg-ping text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-150'
            }`}
          >
            Past ({pastMatches.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-8 h-8 border-4 border-ping border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400 font-medium">Loading matches...</p>
          </div>
        ) : currentMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Trophy size={24} className="text-gray-400" />
            </div>
            <h3 className="font-display font-bold text-lg text-gray-900 mb-2">
              {activeTab === 'upcoming' ? 'No Upcoming Matches' : 'No Past Matches'}
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              {activeTab === 'upcoming'
                ? 'Schedule a match with another player to get started!'
                : 'Your match history will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentMatches.map((match) => (
              <MatchListItem
                key={match.id}
                match={match}
                userId={profile?.id ?? ''}
                onPress={() => onNavigate('matchDetail', { id: match.id })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchListItem({
  match,
  userId,
  onPress,
}: {
  match: Match;
  userId: string;
  onPress: () => void;
}) {
  const statusCfg = STATUS_CONFIG[match.status];
  const StatusIcon = statusCfg.icon;
  
  const opponent = userId === match.player1_id ? match.player2 : match.player1;
  const isWinner = match.winner_id === userId;
  const isCompleted = match.status === 'completed';

  return (
    <button
      onClick={onPress}
      className="w-full bg-white p-4 rounded-[24px] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] text-left hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] active:scale-[0.99] transition-all"
    >
      {/* Header: Opponent & Status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {opponent?.avatar_url ? (
            <img
              src={opponent.avatar_url}
              alt={opponent.full_name}
              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm bg-gray-100"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center text-lg font-bold text-gray-500">
              {opponent?.full_name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold text-gray-900 text-base truncate">
              vs {opponent?.full_name}
            </h3>
            {opponent?.skill_level && (
              <p className="text-xs font-medium text-gray-500 capitalize">
                {opponent.skill_level.replace(/_/g, ' ')}
              </p>
            )}
          </div>
        </div>
        
        <span className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${statusCfg.bg} ${statusCfg.color} shrink-0`}>
          <StatusIcon size={12} />
          {statusCfg.label}
        </span>
      </div>

      {/* Date & Time */}
      <div className="flex items-center gap-2 text-sm text-gray-600 font-medium mb-2">
        <Calendar size={15} className="text-gray-400 shrink-0" />
        <span>{formatMatchDate(match.scheduled_at)}</span>
        <span className="text-gray-300">•</span>
        <span>{formatMatchTime(match.scheduled_at)}</span>
      </div>

      {/* Venue */}
      {match.venue_name && (
        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium mb-3">
          <MapPin size={15} className="text-gray-400 shrink-0" />
          <span className="truncate">{match.venue_name}</span>
        </div>
      )}

      {/* Score Display for Completed Matches */}
      {isCompleted && match.score_player_1 !== null && match.score_player_2 !== null && (
        <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
          <div className={`flex items-center gap-2 ${isWinner ? 'opacity-100' : 'opacity-60'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
              match.winner_id === match.player1_id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {match.score_player_1}
            </div>
            {match.winner_id === match.player1_id && (
              <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Win</span>
            )}
          </div>
          
          <span className="text-gray-300 font-bold">—</span>
          
          <div className={`flex items-center gap-2 ${isWinner ? 'opacity-60' : 'opacity-100'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
              match.winner_id === match.player2_id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {match.score_player_2}
            </div>
            {match.winner_id === match.player2_id && (
              <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Win</span>
            )}
          </div>
        </div>
      )}
    </button>
  );
}
