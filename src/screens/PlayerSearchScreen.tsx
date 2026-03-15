import { useState, useEffect } from 'react';
import { Search, MapPin, UserPlus, Check } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useLocationStore } from '../stores/locationStore';
import { useConnectionsStore } from '../stores/connectionsStore';
import { searchPlayers, type PlayerCard as PlayerCardType } from '../lib/queries/players';

const SKILL_FILTERS = ['All', 'Beginner', 'Casual', 'Intermediate', 'Advanced'];
const DISTANCES = ['5km', '10km', '25km', '50km'];

export default function PlayerSearchScreen({ onNavigate }: { onNavigate: (screen: string, params?: any) => void }) {
  const { profile } = useAuthStore();
  const { coords } = useLocationStore();
  const { send, accepted, pending, sent } = useConnectionsStore();
  
  const [players, setPlayers] = useState<PlayerCardType[]>([]);  
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [distanceIndex, setDistanceIndex] = useState(1); // default 10km

  const distance = DISTANCES[distanceIndex];

  // Debounce search query
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadPlayers = async () => {
    if (!profile?.id) return;
    setIsLoading(true);
    const km = parseInt(distance);
    const results = await searchPlayers(profile.id, {
      lat: coords?.latitude,
      lng: coords?.longitude,
      radiusKm: isNaN(km) ? 10 : km,
      skillLevel: activeFilter !== 'All' ? activeFilter : undefined,
      query: debouncedQuery || undefined,
    });
    setPlayers(results);
    setIsLoading(false);
  };

  useEffect(() => {
    loadPlayers();
  }, [activeFilter, distanceIndex, coords?.latitude, coords?.longitude, profile?.id, debouncedQuery]);

  const getConnectionStatus = (playerId: string) => {
    if (accepted.some(c => c.other_profile.id === playerId)) return 'connected';
    if (sent.some(c => c.other_profile.id === playerId)) return 'sent';
    if (pending.some(c => c.other_profile.id === playerId)) return 'pending';
    return 'none';
  };

  const handleConnect = async (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    if (!profile?.id) return;
    if (getConnectionStatus(playerId) !== 'none') return;
    await send(profile.id, playerId);
  };

  return (
    <div className="min-h-full bg-gray-50 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom)+100px)]">
      {/* Header */}
      <div className="px-5 mb-5">
        <h1 className="font-semibold text-2xl text-gray-900 mb-4">Find Players</h1>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name or username…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none shadow-sm transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
          {/* Distance chip — cycles through values on tap */}
          <button
            onClick={() => setDistanceIndex((distanceIndex + 1) % DISTANCES.length)}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-700 transition-colors hover:bg-gray-50"
          >
            <MapPin size={13} className="text-gray-500" />
            {distance}
          </button>

          <div className="w-px h-6 bg-gray-200 self-center shrink-0" />

          {SKILL_FILTERS.map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition-colors border ${
                activeFilter === filter
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="px-5">
        {/* Result count */}
        {!isLoading && players.length > 0 && (
          <p className="text-xs font-medium text-gray-400 mb-3 px-1">{players.length} player{players.length !== 1 ? 's' : ''} found</p>
        )}

        {isLoading ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
            {[0, 1, 2].map(i => <PlayerSkeleton key={i} />)}
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-white border border-gray-200 shadow-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search size={20} className="text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base mb-1">No players found</h3>
            <p className="text-sm text-gray-500 max-w-[220px] mx-auto leading-relaxed">Try a different skill filter or increase the search radius.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
            {players.map(player => (
              <PlayerRow
                key={player.id}
                player={player}
                connectionStatus={getConnectionStatus(player.id)}
                onClick={() => onNavigate('playerProfile', { id: player.id })}
                onConnect={(e) => handleConnect(e, player.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerSkeleton() {
  return (
    <div className="px-4 py-3.5 flex items-center gap-3.5 animate-pulse">
      <div className="w-11 h-11 rounded-full bg-gray-100 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3.5 w-32 bg-gray-100 rounded-full" />
        <div className="h-3 w-44 bg-gray-100 rounded-full" />
      </div>
      <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
    </div>
  );
}

function PlayerRow({
  player,
  connectionStatus,
  onClick,
  onConnect,
}: {
  player: PlayerCardType;
  connectionStatus: string;
  onClick: () => void;
  onConnect: (e: React.MouseEvent) => void;
}) {
  const distanceStr = player.distance_m != null
    ? player.distance_m > 999
      ? (player.distance_m / 1000).toFixed(1) + ' km'
      : Math.round(player.distance_m) + ' m'
    : null;

  return (
    <div
      onClick={onClick}
      className="px-4 py-3.5 flex items-center gap-3.5 active:bg-gray-50 transition-colors cursor-pointer"
    >
      {/* Avatar */}
      {player.avatar_url ? (
        <img src={player.avatar_url} alt={player.full_name} className="w-11 h-11 rounded-full object-cover bg-gray-100 shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-base shrink-0">
          {player.full_name[0]?.toUpperCase() ?? '?'}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-semibold text-[15px] text-gray-900 truncate">{player.full_name}</h3>
          {player.skill_level && (
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              {player.skill_level}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[13px] text-gray-500 truncate">@{player.username}</p>
          {distanceStr && (
            <>
              <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />
              <span className="text-[12px] text-gray-400 shrink-0 flex items-center gap-0.5">
                <MapPin size={11} />{distanceStr}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Connect button */}
      <button
        onClick={onConnect}
        disabled={connectionStatus !== 'none'}
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
          connectionStatus === 'connected' ? 'bg-emerald-50 text-emerald-600' :
          connectionStatus === 'sent' || connectionStatus === 'pending' ? 'bg-gray-100 text-gray-400' :
          'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95'
        }`}
      >
        {connectionStatus === 'connected' ? <Check size={16} strokeWidth={2.5} /> :
         connectionStatus === 'sent' ? <Check size={16} className="opacity-40" strokeWidth={2.5} /> :
         <UserPlus size={16} />}
      </button>
    </div>
  );
}
