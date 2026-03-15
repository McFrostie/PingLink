import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, SlidersHorizontal, MapPin, Navigation, Plus, Star, ChevronDown, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { useLocationStore } from '../stores/locationStore';
import { useVenueStore } from '../stores/venueStore';
import type { NearbyVenue } from '../lib/queries/venues';

// Defined outside component so the reference is stable (react-google-maps requirement)
const GOOGLE_MAPS_LIBRARIES: ('places' | 'geometry')[] = ['places'];

const FALLBACK_CENTER = { lat: 28.6139, lng: 77.209 };

const MAP_STYLES = [
  { featureType: 'poi' as const, elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit' as const, stylers: [{ visibility: 'off' }] },
];

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  styles: MAP_STYLES,
};

export default function MapScreen({
  onNavigate,
  key,
}: {
  onNavigate: (screen: string, params?: any) => void;
  key?: string | number;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [isFullOpen, setIsFullOpen] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const sheetControls = useAnimation();

  // Force-reset the sheet to its correct position whenever the full overlay
  // opens or closes — this clears any stale drag offset left by the swipe gesture.
  useEffect(() => {
    sheetControls.start({
      y: isSheetOpen ? 0 : 'calc(100% - 200px)',
      transition: { type: 'spring', damping: 25, stiffness: 220, mass: 0.9 },
    });
  }, [isSheetOpen, isFullOpen]);

  const { coords } = useLocationStore();
  const { venues, isLoading, filters, fetchNearby, fetchAll } = useVenueStore();

  const center = coords
    ? { lat: coords.latitude, lng: coords.longitude }
    : FALLBACK_CENTER;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    id: 'pinglink-google-maps',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Fetch venues when location, filters, or showAll mode changes
  useEffect(() => {
    if (showAll) {
      fetchAll(center.lat, center.lng);
    } else {
      fetchNearby(center.lat, center.lng, filters);
    }
  }, [coords, filters.radiusKm, filters.facilityType, filters.minRating, showAll]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleRecenter = () => {
    mapRef.current?.panTo(center);
    mapRef.current?.setZoom(14);
  };

  const displayedVenues = searchQuery.trim()
    ? venues.filter((v) => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : venues;

  // Auto-open sheet if search is used
  useEffect(() => {
    if (searchQuery.trim().length > 0) setIsSheetOpen(true);
  }, [searchQuery]);

  const selectedVenue = selectedVenueId
    ? venues.find((v) => v.id === selectedVenueId) ?? null
    : null;

  return (
    <div className="relative w-full h-full bg-[#E8EAED] overflow-hidden">
      {/* Google Map */}
      <div className="absolute inset-0 w-full h-full">
        {loadError && (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="text-center px-8">
              <MapPin size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium text-sm">Map unavailable</p>
              <p className="text-gray-400 text-xs mt-1">Check your internet connection</p>
            </div>
          </div>
        )}
        {!isLoaded && !loadError && (
          <div className="w-full h-full bg-gray-100 animate-pulse" />
        )}
        {isLoaded && !loadError && (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={13}
            options={MAP_OPTIONS}
            onLoad={onMapLoad}
          >
            {/* Current user marker */}
            <Marker
              position={center}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#FF3366',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
              }}
              title="You are here"
              zIndex={1000}
            />

            {/* Venue markers */}
            {displayedVenues.map((v) => (
              <Marker
                key={v.id}
                position={{ lat: v.latitude, lng: v.longitude }}
                title={v.name}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: selectedVenueId === v.id ? '#FF3366' : '#000000',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2.5,
                }}
                onClick={() => setSelectedVenueId(v.id)}
                zIndex={selectedVenueId === v.id ? 999 : 100}
              />
            ))}

            {/* InfoWindow on marker tap */}
            {selectedVenue && (
              <InfoWindow
                position={{ lat: selectedVenue.latitude, lng: selectedVenue.longitude }}
                onCloseClick={() => setSelectedVenueId(null)}
                options={{ pixelOffset: new google.maps.Size(0, -16) }}
              >
                <button
                  onClick={() => onNavigate('venueDetail', { id: selectedVenue.id })}
                  className="text-left min-w-[160px] max-w-[200px] p-1"
                >
                  <p className="font-bold text-gray-900 text-sm leading-tight mb-0.5">
                    {selectedVenue.name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize mb-1">
                    {selectedVenue.facility_type?.replace(/_/g, ' ') ?? 'Venue'}
                  </p>
                  <div className="flex items-center gap-2">
                    {selectedVenue.average_rating > 0 && (
                      <span className="flex items-center gap-0.5 text-xs font-bold text-yellow-600">
                        ★ {selectedVenue.average_rating.toFixed(1)}
                      </span>
                    )}
                    {selectedVenue.checkin_count > 0 && (
                      <span className="text-xs font-bold text-ping">
                        {selectedVenue.checkin_count} playing
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ping font-bold mt-1">View details →</p>
                </button>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
      </div>

      {/* Top Search Bar */}
      <div className="absolute top-0 left-0 w-full pt-[calc(env(safe-area-inset-top,0px)+1rem)] px-5 z-20 pointer-events-none">
        <div className="max-w-md mx-auto flex gap-2.5 sm:gap-3 pointer-events-auto">
          <div className="flex-1 min-w-0 bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex items-center px-3.5 sm:px-4 h-12 sm:h-14 border border-white/50 transition-all duration-300 focus-within:bg-white focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <Search size={18} className="text-gray-400 shrink-0 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="Search venues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 text-[15px] sm:text-base px-2.5 sm:px-3 text-gray-900 placeholder-gray-400 outline-none font-sans"
            />
          </div>
          <button
            onClick={() => onNavigate('venueFilter')}
            className="w-12 h-12 sm:w-14 sm:h-14 bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex items-center justify-center shrink-0 border border-white/50 text-gray-700 hover:text-ping hover:bg-white transition-all active:scale-95 relative"
          >
            <SlidersHorizontal size={20} className="stroke-[1.5] sm:w-[22px] sm:h-[22px]" />
            {(filters.facilityType || filters.minRating > 0 || filters.radiusKm !== 25) && (
              <div className="absolute top-2.5 right-2.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-ping rounded-full border border-white sm:border-2" />
            )}
          </button>
        </div>
      </div>

      {/* Bottom Sheet (includes floating buttons anchored to it) */}
      <motion.div
        initial={{ y: '100%' }}
        animate={sheetControls}
        drag="y"
        dragConstraints={{ top: -60, bottom: 60 }}
        dragElastic={{ top: 0.4, bottom: 0.15 }}
        onDragEnd={(_, info) => {
          if (isSheetOpen && (info.offset.y < -40 || info.velocity.y < -600)) {
            setIsFullOpen(true);
          } else if (info.offset.y > 60 || info.velocity.y > 500) {
            setIsSheetOpen(false);
          } else if (info.offset.y < -50 || info.velocity.y < -500) {
            setIsSheetOpen(true);
          }
        }}
        className="absolute bottom-0 left-0 w-full z-30 pointer-events-auto flex flex-col justify-end"
      >
        {/* Floating Controls anchored exactly to the top of the Bottom Sheet */}
        <div className="absolute bottom-full left-0 w-full px-5 pb-5 flex justify-between items-end pointer-events-none">
          {/* FAB: Add Venue */}
          <button
            onClick={() => onNavigate('addVenue')}
            className="w-12 h-12 bg-black text-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex items-center justify-center hover:bg-gray-900 hover:scale-105 active:scale-95 transition-all group pointer-events-auto"
          >
            <Plus size={22} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>

          {/* Map Controls */}
          <button
            onClick={handleRecenter}
            className="w-[42px] h-[42px] bg-white/95 backdrop-blur-xl rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center text-gray-700 hover:text-ping transition-all active:scale-95 border border-white/50 pointer-events-auto"
          >
            <Navigation size={18} className="transform -rotate-45 stroke-[2]" />
          </button>
        </div>

        {/* Bottom Sheet Content */}
        <div className="bg-white/95 backdrop-blur-2xl rounded-t-[32px] shadow-[0_-8px_40px_rgba(0,0,0,0.08)] border-t border-white/50 pt-3 pb-[calc(env(safe-area-inset-bottom)+100px)] flex flex-col relative w-full pointer-events-auto">
          {/* Handle */}
          <div 
            className="w-full pt-1 pb-4 cursor-grab active:cursor-grabbing"
            onClick={() => !isSheetOpen && setIsSheetOpen(true)}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto" />
          </div>

          <div 
            className="px-6 flex items-center justify-between mb-4"
            onClick={() => !isSheetOpen && setIsSheetOpen(true)}
          >
            {/* Nearby / All segmented toggle */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-full p-1">
              <button
                onClick={(e) => { e.stopPropagation(); setShowAll(false); }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  !showAll ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                }`}
              >
                Nearby
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  showAll ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                }`}
              >
                All
              </button>
            </div>
            {isLoading ? (
              <span className="text-sm font-medium text-gray-400">Loading…</span>
            ) : (
              <span className="text-xs font-bold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-full uppercase tracking-wider">
                {displayedVenues.length} found
              </span>
            )}
          </div>

          {isLoading && displayedVenues.length === 0 && (
            <div className={`flex overflow-x-auto no-scrollbar pb-6 pt-2 snap-x snap-mandatory ${!isSheetOpen && 'pointer-events-none'}`}>
              <div className="w-6 shrink-0 snap-center" />
              <div className="flex gap-4 shrink-0">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-[calc(100vw-48px)] h-[124px] bg-white rounded-3xl border border-gray-100/50 shadow-sm shrink-0 snap-center p-2 flex flex-row gap-3.5">
                    {/* Image Skeleton */}
                    <div className="w-[108px] h-full bg-gray-100 rounded-[18px] animate-pulse shrink-0" />
                    {/* Content Skeleton */}
                    <div className="flex-1 py-1.5 flex flex-col pt-1">
                      <div className="flex justify-between mb-2">
                        <div className="w-16 h-2.5 bg-gray-100 rounded animate-pulse" />
                        <div className="w-8 h-2.5 bg-gray-100 rounded animate-pulse" />
                      </div>
                      <div className="w-4/5 h-4 bg-gray-100 rounded animate-pulse mb-1.5" />
                      <div className="w-1/2 h-4 bg-gray-100 rounded animate-pulse" />
                      
                      <div className="mt-auto flex items-center justify-between">
                        <div className="w-16 h-2.5 bg-gray-100 rounded animate-pulse" />
                        <div className="w-12 h-2.5 bg-gray-100 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                 ))}
              </div>
              <div className="w-6 shrink-0 snap-center" />
            </div>
          )}

          {!isLoading && displayedVenues.length === 0 && (
            <div className={`px-6 py-8 text-center bg-gray-50/50 mx-6 rounded-3xl border border-gray-100 ${!isSheetOpen && 'pointer-events-none'}`}>
              <p className="text-gray-500 text-sm font-medium">
                No venues found nearby.
              </p>
              <p className="text-gray-400 text-xs mt-1">Try increasing the distance in filters.</p>
            </div>
          )}

          {displayedVenues.length > 0 && (
            <div className={`flex overflow-x-auto no-scrollbar pb-6 pt-2 snap-x snap-mandatory transition-opacity duration-300 ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'} ${!isSheetOpen && 'pointer-events-none'}`}>
              <div className="w-6 shrink-0 snap-center" />
              <div className="flex gap-4 shrink-0">
                {displayedVenues.map((venue) => (
                  <div key={venue.id} className="snap-center">
                    <VenueCard
                      venue={venue}
                      onClick={() => onNavigate('venueDetail', { id: venue.id })}
                    />
                  </div>
                ))}
              </div>
              <div className="w-6 shrink-0 snap-center" />
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Full Venue List Overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {isFullOpen && (
          <motion.div
            key="venueFullList"
            initial={{ y: '100%', borderRadius: '32px 32px 0 0' }}
            animate={{ y: 0, borderRadius: '0px 0px 0 0' }}
            exit={{ y: '100%', borderRadius: '32px 32px 0 0' }}
            transition={{ type: 'spring', damping: 32, stiffness: 280, mass: 0.8 }}
            className="absolute inset-0 bg-gray-50 z-40 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="shrink-0 bg-white pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-4 px-5">
              {/* Top row: back + title + count */}
              <div className="flex items-center gap-3 mb-4">
                <motion.button
                  onClick={() => setIsFullOpen(false)}
                  whileTap={{ scale: 0.9 }}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
                >
                  <ChevronDown size={20} className="text-gray-700" />
                </motion.button>
                <div className="flex-1">
                  <h1 className="font-semibold text-lg text-gray-900 leading-tight">Venues</h1>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                  isLoading ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white'
                }`}>
                  {isLoading ? '…' : displayedVenues.length}
                </span>
              </div>

              {/* Segmented control */}
              <div className="flex items-center bg-gray-100 rounded-2xl p-1 gap-1">
                <button
                  onClick={() => setShowAll(false)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                    !showAll
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Nearby
                </button>
                <button
                  onClick={() => setShowAll(true)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                    showAll
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {/* Search bar */}
            <div className="shrink-0 px-5 py-3 bg-white border-b border-gray-100">
              <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 h-11">
                <Search size={15} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search venues…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
                />
                <AnimatePresence>
                  {searchQuery && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => setSearchQuery('')}
                      className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center shrink-0"
                    >
                      <X size={10} className="text-gray-600" strokeWidth={2.5} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Venue list */}
            <div className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+80px)]">
              {isLoading && displayedVenues.length === 0 ? (
                <div className="divide-y divide-gray-100 bg-white mt-3 mx-4 rounded-2xl overflow-hidden">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-gray-100 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2.5">
                        <div className="w-36 h-3.5 bg-gray-100 rounded-lg animate-pulse" />
                        <div className="w-24 h-3 bg-gray-100 rounded-lg animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : displayedVenues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center px-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <MapPin size={24} className="text-gray-300" />
                  </div>
                  <p className="text-gray-600 font-semibold text-base">No venues found</p>
                  <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className="bg-white mt-3 mx-4 rounded-2xl overflow-hidden border border-gray-100 shadow-sm divide-y divide-gray-100">
                  {displayedVenues.map((venue) => (
                    <VenueListItem
                      key={venue.id}
                      venue={venue}
                      onClick={() => {
                        setIsFullOpen(false);
                        onNavigate('venueDetail', { id: venue.id });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VenueListItem({ venue, onClick }: { venue: NearbyVenue; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
    >
      <div className="w-14 h-14 rounded-2xl bg-gray-100 overflow-hidden shrink-0">
        {venue.cover_url ? (
          <img src={venue.cover_url} alt={venue.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin size={20} className="text-gray-300" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-[15px] text-gray-900 leading-tight truncate">{venue.name}</p>
          {venue.average_rating > 0 && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Star size={11} className="text-yellow-500 fill-yellow-500" />
              <span className="text-xs font-semibold text-gray-700">{venue.average_rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5 capitalize">
          {venue.facility_type?.replace(/_/g, ' ') ?? 'Venue'}
          {venue.distance_m != null &&
            ` · ${venue.distance_m < 1000 ? `${Math.round(venue.distance_m)}m away` : `${(venue.distance_m / 1000).toFixed(1)}km away`}`}
        </p>
        {venue.checkin_count > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <div className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ping opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-ping" />
            </div>
            <span className="text-[11px] font-semibold text-ping">{venue.checkin_count} playing now</span>
          </div>
        )}
      </div>
      <ChevronRight size={16} className="text-gray-200 shrink-0" />
    </button>
  );
}

function VenueCard({ venue, onClick }: { venue: NearbyVenue; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-[calc(100vw-48px)] h-[124px] p-2 bg-white rounded-3xl shadow-[0_2px_12px_rgb(0,0,0,0.06)] border border-gray-100/60 hover:shadow-[0_4px_20px_rgb(0,0,0,0.08)] hover:border-gray-200 text-left flex flex-row gap-3.5 active:scale-[0.98] transition-all shrink-0 group relative overflow-hidden"
    >
      <div className="w-[108px] h-full relative bg-gray-100 overflow-hidden shrink-0 rounded-[20px]">
        {venue.cover_url ? (
          <img src={venue.cover_url} alt={venue.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin size={24} className="text-gray-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-60 mix-blend-multiply" />
        {venue.distance_m != null && (
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
            <span className="text-[9px] font-bold text-white tracking-wide">
              {venue.distance_m < 1000 ? `${Math.round(venue.distance_m)}m` : `${(venue.distance_m / 1000).toFixed(1)}km`}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 py-1 pr-2 flex flex-col pt-[2px] min-w-0">
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-ping truncate shrink">
            {venue.facility_type?.replace(/_/g, ' ') ?? 'VENUE'}
          </span>
          <div className="bg-gray-50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 border border-gray-100">
            <Star size={10} className="text-yellow-500 fill-yellow-500" />
            <span className="text-[10px] font-bold text-gray-700 leading-none mt-[1px]">
              {venue.average_rating > 0 ? venue.average_rating.toFixed(1) : 'New'}
            </span>
          </div>
        </div>
        <h3 className="font-display font-bold text-[16px] text-gray-900 leading-[1.15] mb-1.5 line-clamp-2 group-hover:text-ping transition-colors">
          {venue.name}
        </h3>
        <div className="mt-auto flex items-center justify-between pointer-events-none">
          {venue.checkin_count > 0 ? (
            <div className="flex items-center gap-1.5 bg-ping/5 px-2 py-1 rounded-full border border-ping/10">
              <div className="relative flex h-1.5 w-1.5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ping opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 bg-ping" />
              </div>
              <span className="text-[10px] font-bold text-ping leading-none mt-[1px]">{venue.checkin_count} playing</span>
            </div>
          ) : (
            <span className="text-[10px] font-medium text-gray-400">Not busy</span>
          )}
          <span className="text-[10px] font-medium text-gray-400">
            {venue.review_count} {venue.review_count === 1 ? 'review' : 'reviews'}
          </span>
        </div>
      </div>
    </button>
  );
}
