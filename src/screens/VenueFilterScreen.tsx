import { useState } from 'react';
import { X, Check, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useVenueStore } from '../stores/venueStore';
import { useLocationStore } from '../stores/locationStore';
import type { FacilityType } from '../lib/queries/venues';

const AMENITIES_OPTIONS = [
  { label: 'Bar', value: 'bar' },
  { label: 'Parking', value: 'parking' },
  { label: 'Accessible', value: 'accessible' },
  { label: 'Pro Shop', value: 'pro_shop' },
  { label: 'Coaching', value: 'coaching' },
  { label: 'Showers', value: 'showers' },
  { label: 'WiFi', value: 'wifi' },
  { label: 'Food', value: 'food' },
];

const FACILITY_OPTIONS: { label: string; value: FacilityType }[] = [
  { label: 'Club', value: 'club' },
  { label: 'Sports Center', value: 'sports_center' },
  { label: 'Community Hall', value: 'community_hall' },
  { label: 'School', value: 'school' },
  { label: 'Commercial', value: 'commercial' },
];

const RATING_OPTIONS = [
  { label: '3+', value: 3 },
  { label: '4+', value: 4 },
  { label: '4.5+', value: 4.5 },
  { label: '5', value: 5 },
];

export default function VenueFilterScreen({
  onClose,
  key,
}: {
  onClose: () => void;
  key?: string | number;
}) {
  const { filters, setFilters, fetchNearby } = useVenueStore();
  const { coords } = useLocationStore();

  // Local draft — only applied on "Apply"
  const [distance, setDistance] = useState(filters.radiusKm);
  const [selectedType, setSelectedType] = useState<FacilityType | null>(filters.facilityType);
  const [minRating, setMinRating] = useState(filters.minRating);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(filters.amenities);

  const activeCount = [
    distance !== 25,
    selectedType !== null,
    minRating > 0,
    selectedAmenities.length > 0,
  ].filter(Boolean).length;

  const handleApply = () => {
    const newFilters = { radiusKm: distance, facilityType: selectedType, minRating, amenities: selectedAmenities };
    setFilters(newFilters);
    if (coords) fetchNearby(coords.latitude, coords.longitude, newFilters);
    onClose();
  };

  const handleReset = () => {
    setDistance(25);
    setSelectedType(null);
    setMinRating(0);
    setSelectedAmenities([]);
  };

  const toggleAmenity = (value: string) =>
    setSelectedAmenities((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value],
    );

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-50 bg-gray-50 flex flex-col"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-gray-100 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-4 px-5 flex items-center gap-3">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors shrink-0"
        >
          <X size={18} className="text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-lg text-gray-900">Filters</h1>
        </div>
        {activeCount > 0 && (
          <span className="text-xs font-semibold bg-gray-900 text-white px-2.5 py-1 rounded-full">
            {activeCount} active
          </span>
        )}
        <button
          onClick={handleReset}
          className="text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+96px)]">
        <div className="px-4 pt-4 space-y-3">

          {/* Distance */}
          <FilterSection title="Distance">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-gray-500">Search radius</p>
              <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                {distance} km
              </span>
            </div>
            <div className="relative px-1">
              {/* Track fill background */}
              <div className="relative h-1.5 bg-gray-200 rounded-full">
                <div
                  className="absolute left-0 top-0 h-full bg-gray-900 rounded-full transition-all"
                  style={{ width: `${((distance - 1) / 49) * 100}%` }}
                />
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={distance}
                onChange={(e) => setDistance(parseInt(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-1.5"
                style={{ top: 0 }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-3">
              <span>1 km</span>
              <span>50 km</span>
            </div>
          </FilterSection>

          {/* Facility Type */}
          <FilterSection title="Facility Type">
            <div className="flex flex-wrap gap-2">
              <Chip
                label="Any"
                selected={selectedType === null}
                onClick={() => setSelectedType(null)}
              />
              {FACILITY_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={selectedType === opt.value}
                  onClick={() => setSelectedType(selectedType === opt.value ? null : opt.value)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Minimum Rating */}
          <FilterSection title="Minimum Rating">
            <div className="flex gap-2">
              <button
                onClick={() => setMinRating(0)}
                className={`flex-1 h-11 rounded-2xl border text-sm font-semibold transition-all active:scale-95 ${
                  minRating === 0
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                Any
              </button>
              {RATING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMinRating(opt.value)}
                  className={`flex-1 h-11 rounded-2xl border text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1 ${
                    minRating === opt.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  <Star
                    size={11}
                    className={minRating === opt.value ? 'text-yellow-400 fill-yellow-400' : 'text-yellow-400 fill-yellow-400'}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </FilterSection>

          {/* Amenities */}
          <FilterSection title="Amenities">
            <div className="flex flex-wrap gap-2">
              {AMENITIES_OPTIONS.map((amenity) => (
                <Chip
                  key={amenity.value}
                  label={amenity.label}
                  selected={selectedAmenities.includes(amenity.value)}
                  onClick={() => toggleAmenity(amenity.value)}
                />
              ))}
            </div>
          </FilterSection>

        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-t border-gray-100 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <button
          onClick={handleApply}
          className="w-full h-12 bg-gray-900 text-white text-sm font-semibold rounded-2xl hover:bg-gray-800 active:scale-[0.98] transition-all shadow-sm"
        >
          {activeCount > 0 ? `Apply ${activeCount} Filter${activeCount > 1 ? 's' : ''}` : 'Apply Filters'}
        </button>
      </div>
    </motion.div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-500 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-medium transition-all active:scale-95 ${
        selected
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
      }`}
    >
      {selected && <Check size={11} strokeWidth={3} />}
      {label}
    </button>
  );
}
