import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Calendar, MapPin, MessageSquare, ChevronRight, Clock } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useConnectionsStore } from '../stores/connectionsStore';
import { useVenueStore } from '../stores/venueStore';
import { useLocationStore } from '../stores/locationStore';
import { useMatchesStore } from '../stores/matchesStore';

// Minimum datetime-local value = now (can't schedule in the past)
function getNowLocalISO(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export default function MatchSchedulingScreen({
  onBack,
  onCreated,
  preselectedOpponentId,
}: {
  onBack: () => void;
  onCreated: (matchId: string) => void;
  preselectedOpponentId?: string;
}) {
  const { profile } = useAuthStore();
  const { accepted, fetchAll } = useConnectionsStore();
  const { venues, fetchNearby } = useVenueStore();
  const { coords } = useLocationStore();
  const { create } = useMatchesStore();

  const [step, setStep] = useState<'opponent' | 'details'>(
    preselectedOpponentId ? 'details' : 'opponent'
  );

  // Opponent
  const [opponentId, setOpponentId] = useState(preselectedOpponentId ?? '');
  const [opponentSearch, setOpponentSearch] = useState('');

  // Match details
  const [scheduledAt, setScheduledAt] = useState('');
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueSearch, setVenueSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile?.id) fetchAll(profile.id);
  }, [profile?.id]);

  useEffect(() => {
    if (coords) fetchNearby(coords.latitude, coords.longitude);
  }, [coords?.latitude]);

  const selectedOpponent = accepted.find(c => c.other_profile.id === opponentId)?.other_profile;

  const filteredConnections = accepted.filter(c =>
    c.other_profile.full_name.toLowerCase().includes(opponentSearch.toLowerCase())
  );

  const filteredVenues = venues.filter(v =>
    v.name.toLowerCase().includes(venueSearch.toLowerCase())
  ).slice(0, 10);

  const selectedVenue = venues.find(v => v.id === venueId);

  const handleSubmit = async () => {
    if (!opponentId || !scheduledAt || !profile?.id) {
      setError('Please select an opponent and a date/time.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    const matchId = await create({
      player2_id: opponentId,
      venue_id: venueId,
      scheduled_at: new Date(scheduledAt).toISOString(),
      notes: notes.trim(),
      created_by: profile.id,
    });
    setIsSubmitting(false);
    if (matchId) {
      onCreated(matchId);
    } else {
      setError('Failed to create match. Please try again.');
    }
  };

  return (
    <div className="absolute inset-0 bg-[#FAFAFA] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center gap-3 shadow-sm">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 transition-all">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-xl text-gray-900">Schedule a Match</h1>
          <p className="text-xs text-gray-500 font-medium">
            {step === 'opponent' ? 'Step 1 of 2 — Choose opponent' : 'Step 2 of 2 — Match details'}
          </p>
        </div>
        {/* Step indicator */}
        <div className="flex gap-1.5">
          <div className={`w-8 h-1.5 rounded-full transition-colors ${step === 'opponent' ? 'bg-ping' : 'bg-ping'}`} />
          <div className={`w-8 h-1.5 rounded-full transition-colors ${step === 'details' ? 'bg-ping' : 'bg-gray-200'}`} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ───────────── STEP 1: PICK OPPONENT ───────────── */}
        {step === 'opponent' && (
          <div className="p-5 space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search connections..."
                value={opponentSearch}
                onChange={e => setOpponentSearch(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-ping/20 focus:border-ping transition-all"
              />
            </div>

            {filteredConnections.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm font-medium">
                No connections found. Connect with players first!
              </div>
            )}

            <div className="space-y-2.5">
              {filteredConnections.map(conn => {
                const p = conn.other_profile;
                const isSelected = opponentId === p.id;
                return (
                  <div
                    key={conn.id}
                    onClick={() => { setOpponentId(p.id); setStep('details'); }}
                    className={`flex items-center gap-3.5 p-3.5 rounded-2xl border cursor-pointer transition-all active:scale-[0.98]
                      ${isSelected
                        ? 'bg-ping/5 border-ping shadow-sm'
                        : 'bg-white border-gray-100 shadow-sm hover:border-gray-200'
                      }`}
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} className="w-12 h-12 rounded-full object-cover border border-gray-100" alt={p.full_name} />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center font-bold text-lg text-gray-500">
                        {p.full_name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{p.full_name}</p>
                      {p.skill_level && (
                        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                          {p.skill_level}
                        </span>
                      )}
                    </div>
                    <ChevronRight size={18} className="text-gray-300 shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ───────────── STEP 2: MATCH DETAILS ───────────── */}
        {step === 'details' && (
          <div className="p-5 space-y-4">
            {/* Selected Opponent recap */}
            {selectedOpponent && (
              <div className="flex items-center gap-3.5 p-3.5 bg-white border border-gray-100 rounded-2xl shadow-sm">
                {selectedOpponent.avatar_url ? (
                  <img src={selectedOpponent.avatar_url} className="w-11 h-11 rounded-full object-cover" alt={selectedOpponent.full_name} />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500">
                    {selectedOpponent.full_name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Challenging</p>
                  <p className="font-bold text-gray-900">{selectedOpponent.full_name}</p>
                </div>
                {!preselectedOpponentId && (
                  <button
                    onClick={() => setStep('opponent')}
                    className="text-xs font-bold text-ping hover:underline"
                  >
                    Change
                  </button>
                )}
              </div>
            )}

            {/* Date & Time */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                <Clock size={13} />
                Date & Time
              </label>
              <input
                type="datetime-local"
                min={getNowLocalISO()}
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full text-gray-900 font-semibold text-base bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ping/20 focus:border-ping transition-all"
              />
            </div>

            {/* Venue (optional) */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                <MapPin size={13} />
                Venue <span className="font-normal text-gray-400 normal-case tracking-normal">(Optional)</span>
              </label>

              {selectedVenue ? (
                <div className="flex items-center gap-3 p-3 bg-ping/5 border border-ping/20 rounded-xl">
                  <MapPin size={16} className="text-ping shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate text-sm">{selectedVenue.name}</p>
                    <p className="text-xs text-gray-500 truncate">{selectedVenue.address}</p>
                  </div>
                  <button onClick={() => setVenueId(null)} className="text-xs font-bold text-gray-400 hover:text-gray-600">Remove</button>
                </div>
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search venues..."
                      value={venueSearch}
                      onChange={e => setVenueSearch(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-ping/20 focus:border-ping transition-all"
                    />
                  </div>
                  {venueSearch.length > 0 && (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {filteredVenues.length === 0 && (
                        <p className="text-center text-xs text-gray-400 py-2">No venues found nearby</p>
                      )}
                      {filteredVenues.map(v => (
                        <button
                          key={v.id}
                          onClick={() => { setVenueId(v.id); setVenueSearch(''); }}
                          className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl transition-colors"
                        >
                          <MapPin size={14} className="text-gray-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{v.name}</p>
                            <p className="text-xs text-gray-500 truncate">{v.address}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                <MessageSquare size={13} />
                Message <span className="font-normal text-gray-400 normal-case tracking-normal">(Optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder='e.g. "Best of 5, bring your own paddle!"'
                rows={3}
                maxLength={500}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-ping/20 focus:border-ping transition-all resize-none"
              />
              <p className="text-right text-xs text-gray-400 mt-1">{notes.length}/500</p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      {step === 'details' && (
        <div className="shrink-0 bg-white border-t border-gray-100 px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <button
            onClick={handleSubmit}
            disabled={!opponentId || !scheduledAt || isSubmitting}
            className="w-full py-4 rounded-2xl bg-ping text-white font-bold text-base disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm"
          >
            {isSubmitting ? 'Sending Challenge...' : '🏓  Send Match Challenge'}
          </button>
        </div>
      )}
    </div>
  );
}
