import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, MapPin, Camera, Plus, Minus, Check, Loader2, X, ChevronDown } from 'lucide-react';
import { useJsApiLoader } from '@react-google-maps/api';
import { useAuthStore } from '../stores/authStore';
import { useLocationStore } from '../stores/locationStore';
import { useVenueStore } from '../stores/venueStore';
import { insertVenue, uploadVenuePhoto, type FacilityType } from '../lib/queries/venues';

// Must be stable reference — matches MapScreen’s loader config
const GOOGLE_MAPS_LIBRARIES: ('places' | 'geometry')[] = ['places'];

const FACILITY_OPTIONS: { label: string; value: FacilityType }[] = [
  { label: 'Club', value: 'club' },
  { label: 'Sports Center', value: 'sports_center' },
  { label: 'Community Hall', value: 'community_hall' },
  { label: 'School', value: 'school' },
  { label: 'Commercial', value: 'commercial' },
];

const AMENITY_OPTIONS = [
  { value: 'parking', label: 'Parking' },
  { value: 'changing_rooms', label: 'Changing Rooms' },
  { value: 'equipment_rental', label: 'Equipment Rental' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'cafeteria', label: 'Cafeteria' },
  { value: 'bar', label: 'Bar' },
  { value: 'pro_shop', label: 'Pro Shop' },
];

interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export default function AddVenueScreen({ onBack }: { onBack: () => void }) {
  const { session } = useAuthStore();
  const { coords } = useLocationStore();
  const { fetchNearby, filters } = useVenueStore();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    id: 'pinglink-google-maps',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Form state
  const [name, setName] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(coords?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(coords?.longitude ?? null);
  const [facilityType, setFacilityType] = useState<FacilityType | ''>('');
  const [tables, setTables] = useState(2);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceDivRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Initialise Places services once the Maps JS API is loaded
  useEffect(() => {
    if (!isLoaded) return;
    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    if (placesServiceDivRef.current) {
      placesServiceRef.current = new google.maps.places.PlacesService(placesServiceDivRef.current);
    }
  }, [isLoaded]);

  const fetchSuggestions = useCallback((query: string) => {
    if (!autocompleteServiceRef.current || query.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsFetchingSuggestions(true);
    autocompleteServiceRef.current.getPlacePredictions(
      { input: query, types: ['geocode', 'establishment'] },
      (predictions, status) => {
        setIsFetchingSuggestions(false);
        if (
          status === google.maps.places.PlacesServiceStatus.OK &&
          predictions &&
          predictions.length > 0
        ) {
          setSuggestions(
            predictions.slice(0, 2).map((p) => ({
              placeId: p.place_id,
              mainText: p.structured_formatting.main_text,
              secondaryText: p.structured_formatting.secondary_text ?? '',
            })),
          );
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      },
    );
  }, []);

  const handleAddressChange = (value: string) => {
    setAddressInput(value);
    if (resolvedAddress) {
      setResolvedAddress('');
      setLatitude(null);
      setLongitude(null);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const handleSelectSuggestion = (suggestion: PlaceSuggestion) => {
    if (!placesServiceRef.current) return;
    setShowSuggestions(false);
    setAddressInput(suggestion.mainText + (suggestion.secondaryText ? `, ${suggestion.secondaryText}` : ''));
    setIsFetchingSuggestions(true);
    placesServiceRef.current.getDetails(
      { placeId: suggestion.placeId, fields: ['geometry', 'formatted_address'] },
      (place, status) => {
        setIsFetchingSuggestions(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          setLatitude(place.geometry.location.lat());
          setLongitude(place.geometry.location.lng());
          setResolvedAddress(place.formatted_address ?? suggestion.mainText);
          setAddressInput(place.formatted_address ?? suggestion.mainText);
        }
      },
    );
  };

  const clearAddress = () => {
    setAddressInput('');
    setResolvedAddress('');
    setLatitude(null);
    setLongitude(null);
    setSuggestions([]);
    setShowSuggestions(false);
    addressInputRef.current?.focus();
  };

  const toggleAmenity = (value: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value],
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 5 - photoFiles.length);
    setPhotoFiles((prev) => [...prev, ...files]);
    files.forEach((file) => {
      setPhotoPreviewUrls((prev) => [...prev, URL.createObjectURL(file)]);
    });
  };

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!session?.user?.id) return;
    if (!name.trim()) { setError('Please enter a venue name.'); return; }
    if (!addressInput.trim()) { setError('Please enter an address.'); return; }
    if (!latitude || !longitude) {
      setError('Please select an address from the suggestions to pin its location.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    const venueId = await insertVenue(session.user.id, {
      name: name.trim(),
      address: resolvedAddress || addressInput.trim(),
      latitude,
      longitude,
      facility_type: facilityType || null,
      num_tables: tables,
      amenities: selectedAmenities,
      description: description.trim(),
      contact_phone: phone.trim(),
      contact_website: website.trim(),
    });

    if (!venueId) {
      setError('Failed to submit venue. Please try again.');
      setIsSubmitting(false);
      return;
    }

    for (let i = 0; i < photoFiles.length; i++) {
      await uploadVenuePhoto(venueId, session.user.id, photoFiles[i], i === 0, i);
    }

    if (coords) fetchNearby(coords.latitude, coords.longitude, filters);
    setSuccess(true);
    setIsSubmitting(false);
  };

  // ── Success state ──────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-full bg-gray-50 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <Check size={34} className="text-emerald-500" strokeWidth={2.5} />
        </div>
        <h2 className="font-semibold text-2xl text-gray-900 mb-2">Venue Submitted</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-[260px]">
          Your venue is under review and will appear on the map once approved.
        </p>
        <button
          onClick={onBack}
          className="px-8 py-3 bg-gray-900 text-white text-sm font-semibold rounded-2xl hover:bg-gray-800 active:scale-[0.98] transition-all"
        >
          Back to Map
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Invisible PlacesService anchor — must stay in DOM */}
      <div ref={placesServiceDivRef} className="hidden" />

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 flex items-center gap-3 z-20">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 transition-all"
        >
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="flex-1 font-semibold text-xl text-gray-900">Add a Venue</h1>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+96px)]">
        <div className="px-4 pt-5 space-y-3">

          {/* ── Location ────────────────────────────────────────────── */}
          <Section title="Location">
            {/* Address input with autocomplete dropdown */}
            <div className="relative">
              <div className={`flex items-center gap-3 border bg-white rounded-xl px-3.5 h-12 transition-colors ${
                showSuggestions ? 'border-gray-400 ring-1 ring-gray-300' : 'border-gray-200'
              }`}>
                {isFetchingSuggestions ? (
                  <Loader2 size={16} className="text-gray-400 shrink-0 animate-spin" />
                ) : latitude && longitude ? (
                  <Check size={16} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                ) : (
                  <MapPin size={16} className="text-gray-400 shrink-0" />
                )}
                <input
                  ref={addressInputRef}
                  type="text"
                  placeholder="Search address or venue…"
                  value={addressInput}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none min-w-0"
                />
                {addressInput.length > 0 && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); clearAddress(); }}
                    className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center shrink-0 hover:bg-gray-300 transition-colors"
                  >
                    <X size={11} className="text-gray-600" strokeWidth={2.5} />
                  </button>
                )}
              </div>

              {/* Autocomplete dropdown — max 2 suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden z-50">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.placeId}
                      onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                        i > 0 ? 'border-t border-gray-100' : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <MapPin size={14} className="text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.mainText}</p>
                        {s.secondaryText && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{s.secondaryText}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Resolved confirmation */}
            {latitude && longitude && resolvedAddress && (
              <div className="flex items-start gap-2 mt-2 px-1">
                <Check size={13} className="text-emerald-500 mt-0.5 shrink-0" strokeWidth={2.5} />
                <p className="text-xs text-emerald-600 font-medium leading-snug">{resolvedAddress}</p>
              </div>
            )}

            {/* Use current location shortcut */}
            {coords && !latitude && (
              <button
                onClick={() => {
                  setLatitude(coords.latitude);
                  setLongitude(coords.longitude);
                  setResolvedAddress('Current location');
                  setAddressInput('Current location');
                }}
                className="flex items-center gap-1.5 mt-2 px-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                <MapPin size={12} />
                Use my current location
              </button>
            )}
          </Section>

          {/* ── Basic Details ───────────────────────────────────────────── */}
          <Section title="Basic Details">
            <FieldLabel label="Venue Name" required />
            <input
              type="text"
              placeholder="e.g. Spin Seattle"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 px-3.5 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 transition-colors"
            />
            <FieldLabel label="Facility Type" className="mt-3.5" />
            <div className="relative">
              <select
                value={facilityType}
                onChange={(e) => setFacilityType(e.target.value as FacilityType | '')}
                className="w-full h-12 pl-3.5 pr-10 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl outline-none appearance-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 transition-colors"
              >
                <option value="">Select type…</option>
                {FACILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </Section>

          {/* ── Facility ─────────────────────────────────────────────────── */}
          <Section title="Facility">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Tables</p>
                <p className="text-xs text-gray-400 mt-0.5">Estimated count</p>
              </div>
              <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-3 py-2">
                <button
                  onClick={() => setTables(Math.max(0, tables - 1))}
                  className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-700 active:scale-95 transition-all shadow-sm"
                >
                  <Minus size={14} strokeWidth={2.5} />
                </button>
                <span className="font-semibold text-gray-900 text-sm w-5 text-center">{tables}</span>
                <button
                  onClick={() => setTables(tables + 1)}
                  className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-700 active:scale-95 transition-all shadow-sm"
                >
                  <Plus size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            <div className="mt-4">
              <FieldLabel label="Amenities" />
              <div className="flex flex-wrap gap-2 mt-2">
                {AMENITY_OPTIONS.map((amenity) => {
                  const active = selectedAmenities.includes(amenity.value);
                  return (
                    <button
                      key={amenity.value}
                      onClick={() => toggleAmenity(amenity.value)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-medium transition-all active:scale-95 ${
                        active
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {active && <Check size={11} strokeWidth={3} />}
                      {amenity.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* ── Description & Photos ───────────────────────────────────────── */}
          <Section title="Description & Photos">
            <textarea
              placeholder="Tell us about this venue… (table quality, lighting, atmosphere)"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              className="w-full px-3.5 py-3 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 transition-colors resize-none min-h-[100px]"
            />
            <div className="flex justify-end mt-1">
              <span className="text-xs text-gray-400">{description.length} / 300</span>
            </div>
            <div className="mt-3">
              <FieldLabel label={`Photos (${photoFiles.length} / 5)`} />
              <div className="flex gap-2.5 mt-2 overflow-x-auto no-scrollbar pb-1">
                {photoPreviewUrls.map((url, i) => (
                  <div key={i} className="w-[72px] h-[72px] shrink-0 rounded-xl overflow-hidden relative">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                    >
                      <X size={9} className="text-white" strokeWidth={3} />
                    </button>
                  </div>
                ))}
                {photoFiles.length < 5 && (
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="w-[72px] h-[72px] shrink-0 rounded-xl border-2 border-dashed border-gray-200 bg-white flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Camera size={20} className="mb-1" />
                    <span className="text-[10px] font-medium">Add</span>
                  </button>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>
          </Section>

          {/* ── Contact Info ───────────────────────────────────────────────── */}
          <Section title="Contact Info" badge="Optional">
            <input
              type="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-12 px-3.5 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 transition-colors"
            />
            <input
              type="url"
              placeholder="Website URL"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full h-12 px-3.5 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 transition-colors mt-3"
            />
          </Section>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
          )}

        </div>
      </div>

      {/* ── Fixed footer ───────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-t border-gray-100 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <p className="text-xs text-gray-400 text-center mb-3 leading-relaxed">
          Submitted venues are reviewed before appearing on the public map.
        </p>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full h-12 bg-gray-900 text-white text-sm font-semibold rounded-2xl hover:bg-gray-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Submitting…
            </>
          ) : (
            'Submit Venue'
          )}
        </button>
      </div>
    </div>
  );
}

// ── Shared layout helpers ──────────────────────────────────────────────────

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500">{title}</h2>
        {badge && (
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ label, required, className }: { label: string; required?: boolean; className?: string }) {
  return (
    <p className={`text-xs font-medium text-gray-500 mb-1.5 ${className ?? ''}`}>
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </p>
  );
}
