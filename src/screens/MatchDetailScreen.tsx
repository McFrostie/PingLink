import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Calendar, MessageSquare, CheckCircle, XCircle, Trophy, Clock, X } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useMatchesStore } from '../stores/matchesStore';
import { getOrCreateConversation } from '../lib/queries/messages';
import { recordMatchScore } from '../lib/queries/matches';
import { supabase } from '../lib/supabase';
import type { Match } from '../lib/queries/matches';

// Status config
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: 'text-amber-700',  bg: 'bg-amber-100'  },
  confirmed: { label: 'Confirmed', color: 'text-emerald-700',bg: 'bg-emerald-100'},
  cancelled: { label: 'Cancelled', color: 'text-red-700',    bg: 'bg-red-100'    },
  completed: { label: 'Completed', color: 'text-blue-700',   bg: 'bg-blue-100'   },
};

function formatMatchDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function PlayerCard({ player, label }: { player: any; label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-2 p-4">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      {player?.avatar_url ? (
        <img src={player.avatar_url} className="w-20 h-20 rounded-full object-cover border-2 border-gray-50 shadow-sm" alt={player.full_name} />
      ) : (
        <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-gray-50 shadow-sm flex items-center justify-center text-2xl font-semibold text-gray-500">
          {player?.full_name?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
      <p className="font-semibold text-sm text-gray-900 text-center leading-snug">{player?.full_name ?? '…'}</p>
      {player?.skill_level && (
        <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full border border-gray-200">
          {player.skill_level}
        </span>
      )}
    </div>
  );
}

export default function MatchDetailScreen({
  onBack,
  onNavigate,
  matchId,
}: {
  onBack: () => void;
  onNavigate?: (screen: string, params?: any) => void;
  matchId: string;
}) {
  const { profile } = useAuthStore();
  const { selectedMatch, isLoadingDetail, fetchDetail, respond, cancel } = useMatchesStore();
  
  const [match, setMatch] = useState<Match | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scoreP1, setScoreP1] = useState('');
  const [scoreP2, setScoreP2] = useState('');
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);

  useEffect(() => {
    fetchDetail(matchId);
  }, [matchId]);

  // Set local match state when store updates
  useEffect(() => {
    if (selectedMatch) {
      setMatch(selectedMatch);
    }
  }, [selectedMatch]);

  // Realtime subscription for match updates
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`
        },
        (payload) => {
          setMatch(payload.new as any);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);
  const myId = profile?.id ?? '';

  const isCreator  = match?.created_by === myId;
  const isPlayer2  = match?.player2_id === myId;
  const isParticipant = match?.player1_id === myId || match?.player2_id === myId;
  const statusCfg  = STATUS_CONFIG[match?.status ?? 'pending'];

  const opponent = match
    ? (myId === match.player1_id ? match.player2 : match.player1)
    : null;

  const handleMessage = async () => {
    if (!myId || !opponent?.id || !onNavigate) return;
    const convId = await getOrCreateConversation(myId, opponent.id);
    if (convId) {
      onNavigate('chat', { id: convId, participant: opponent });
    }
  };

  const handleSubmitScore = async () => {
    if (!match || !scoreP1 || !scoreP2) return;
    
    const s1 = parseInt(scoreP1);
    const s2 = parseInt(scoreP2);
    
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) return;
    
    const winnerId = s1 > s2 ? match.player1_id : match.player2_id;
    
    setIsSubmittingScore(true);
    const success = await recordMatchScore(matchId, s1, s2, winnerId);
    setIsSubmittingScore(false);
    
    if (success) {
      setShowScoreModal(false);
      setScoreP1('');
      setScoreP2('');
      // Realtime will update the match or refetch
      await fetchDetail(matchId);
    }
  };

  return (
    <div className="absolute inset-0 bg-gray-50 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 transition-all">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="flex-1 font-display font-bold text-xl text-gray-900">Match details</h1>
        {match && isParticipant && opponent && onNavigate && (
          <button
            onClick={handleMessage}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
            title={`Message ${opponent.full_name?.split(' ')[0]}`}
          >
            <MessageSquare size={17} className="text-gray-600" />
          </button>
        )}
        {match && (
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoadingDetail && !match && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading match…</p>
          </div>
        )}

        {match && (
          <>
            {/* ── Players hero ── */}
            <div className="bg-white border-b border-gray-100">
              <div className="flex items-center">
                <PlayerCard player={match.player1} label="Challenger" />
                <div className="flex flex-col items-center gap-1 shrink-0 px-2">
                  <span className="text-2xl font-display font-bold text-gray-900">VS</span>
                  <span className="text-[10px] font-medium text-gray-400 tracking-wider">1v1</span>
                </div>
                <PlayerCard player={match.player2} label="Challenged" />
              </div>
            </div>

            {/* ── Info cards ── */}
            <div className="p-5 space-y-3">

              {/* Date + Venue combined */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
                <div className="p-4 flex items-center gap-3.5">
                  <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                    <Calendar size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-0.5">Scheduled</p>
                    <p className="font-semibold text-sm text-gray-900">{formatMatchDate(match.scheduled_at)}</p>
                  </div>
                </div>
                {match.venue_name && (
                  <div
                    className="p-4 flex items-center gap-3.5 cursor-pointer active:bg-gray-50 transition-colors"
                    onClick={() => match.venue_id && onNavigate?.('venueDetail', { id: match.venue_id })}
                  >
                    <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                      <MapPin size={16} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-400 mb-0.5">Venue</p>
                      <p className="font-semibold text-sm text-gray-900 truncate">{match.venue_name}</p>
                    </div>
                    <span className="text-xs font-medium text-gray-400">View →</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {match.notes && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
                  <p className="text-xs font-medium text-gray-400 mb-1.5">Message</p>
                  <p className="text-sm text-gray-700 leading-relaxed">"{match.notes}"</p>
                </div>
              )}

              {/* Final score (completed) */}
              {match.status === 'completed' && match.score_player_1 !== null && match.score_player_2 !== null && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                  <p className="text-sm font-semibold text-gray-500 mb-4">Final score</p>
                  <div className="flex items-center justify-center gap-6">
                    <div className={`flex flex-col items-center gap-2 ${match.winner_id === match.player1_id ? 'opacity-100' : 'opacity-50'}`}>
                      <p className="text-xs font-medium text-gray-500">{match.player1?.full_name?.split(' ')[0]}</p>
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-display font-bold ${match.winner_id === match.player1_id ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {match.score_player_1}
                      </div>
                      {match.winner_id === match.player1_id && (
                        <span className="text-xs font-semibold text-green-600">Winner</span>
                      )}
                    </div>
                    <span className="text-xl font-display font-bold text-gray-300 mb-4">—</span>
                    <div className={`flex flex-col items-center gap-2 ${match.winner_id === match.player2_id ? 'opacity-100' : 'opacity-50'}`}>
                      <p className="text-xs font-medium text-gray-500">{match.player2?.full_name?.split(' ')[0]}</p>
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-display font-bold ${match.winner_id === match.player2_id ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {match.score_player_2}
                      </div>
                      {match.winner_id === match.player2_id && (
                        <span className="text-xs font-semibold text-green-600">Winner</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Actions ── */}
              <div className="space-y-2 pt-1">
                {isPlayer2 && match.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => respond(matchId, false)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-semibold active:scale-[0.97] transition-all"
                    >
                      <XCircle size={16} />
                      Decline
                    </button>
                    <button
                      onClick={() => respond(matchId, true)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-semibold shadow-sm active:scale-[0.97] transition-all"
                    >
                      <CheckCircle size={16} />
                      Accept
                    </button>
                  </div>
                )}

                {isParticipant && match.status === 'confirmed' && (
                  <button
                    onClick={() => setShowScoreModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold shadow-sm active:scale-[0.97] transition-all"
                  >
                    <Trophy size={16} />
                    Complete match & record score
                  </button>
                )}

                {isCreator && (match.status === 'pending' || match.status === 'confirmed') && (
                  <button
                    onClick={() => cancel(matchId)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-gray-200 text-gray-600 text-sm font-semibold active:scale-[0.97] transition-all"
                  >
                    <XCircle size={15} className="text-gray-400" />
                    Cancel match
                  </button>
                )}
              </div>

              {isCreator && match.status === 'pending' && (
                <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-100 rounded-2xl">
                  <Clock size={15} className="text-amber-500 shrink-0" />
                  <p className="text-xs font-medium text-amber-700 leading-snug">
                    Waiting for {match.player2?.full_name?.split(' ')[0]} to accept your challenge.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Score modal ── */}
      {showScoreModal && match && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-5">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-xl text-gray-900">Record score</h3>
              <button
                onClick={() => setShowScoreModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {match.player1?.full_name}
                </label>
                <input
                  type="number"
                  min="0"
                  value={scoreP1}
                  onChange={(e) => setScoreP1(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 text-lg font-bold text-gray-900"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {match.player2?.full_name}
                </label>
                <input
                  type="number"
                  min="0"
                  value={scoreP2}
                  onChange={(e) => setScoreP2(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 text-lg font-bold text-gray-900"
                  placeholder="0"
                />
              </div>

              {scoreP1 && scoreP2 && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <p className="text-sm font-semibold text-gray-900">
                    Winner: {parseInt(scoreP1) > parseInt(scoreP2) ? match.player1?.full_name : match.player2?.full_name}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowScoreModal(false)}
                disabled={isSubmittingScore}
                className="flex-1 py-3 rounded-2xl border border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitScore}
                disabled={!scoreP1 || !scoreP2 || isSubmittingScore}
                className="flex-1 py-3 rounded-2xl bg-gray-900 text-white font-semibold hover:bg-black active:scale-95 transition-all disabled:opacity-50 disabled:bg-gray-200"
              >
                {isSubmittingScore ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
