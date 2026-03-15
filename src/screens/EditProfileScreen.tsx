import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Search, X } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import {
  fetchPreferredVenues,
  fetchUserAvailability,
  searchPreferredVenueOptions,
  syncPreferredVenues,
  syncUserAvailability,
  updateProfile,
  uploadProfileImage,
  type VenueSearchResult,
} from '../lib/queries/profile';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIMES = ['morning', 'afternoon', 'evening', 'night'] as const;
const STYLES = ['offensive', 'defensive', 'all_round'];
const GRIPS = ['penhold', 'shakehand'];
const TECHNIQUES = ['heavy_topspin', 'chopper', 'looper', 'blocker'];
const SKILLS = ['beginner', 'casual', 'intermediate', 'advanced', 'professional'] as const;

function normalizeUsername(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
}

export default function EditProfileScreen({ onBack }: { onBack: () => void }) {
  const profile = useAuthStore((state) => state.profile);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [skillLevel, setSkillLevel] = useState<string>('');
  const [playingStyles, setPlayingStyles] = useState<string[]>([]);
  const [grips, setGrips] = useState<string[]>([]);
  const [techniques, setTechniques] = useState<string[]>([]);
  const [showLocation, setShowLocation] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'connections_only'>('public');
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([]);
  const [preferredVenues, setPreferredVenues] = useState<VenueSearchResult[]>([]);
  const [venueQuery, setVenueQuery] = useState('');
  const [venueResults, setVenueResults] = useState<VenueSearchResult[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [availability, preferred] = await Promise.all([
        fetchUserAvailability(profile.id),
        fetchPreferredVenues(profile.id),
      ]);

      if (!isMounted) return;

      setUsername(profile.username);
      setFullName(profile.full_name);
      setBio(profile.bio ?? '');
      setCity(profile.city ?? '');
      setDateOfBirth(profile.date_of_birth ?? '');
      setSkillLevel(profile.skill_level ?? '');
      setPlayingStyles(profile.playing_styles);
      setGrips(profile.grips);
      setTechniques(profile.techniques);
      setShowLocation(profile.show_location);
      setShowOnlineStatus(profile.show_online_status);
      setProfileVisibility(profile.profile_visibility);
      setSelectedAvailability(availability.map((slot) => `${slot.day_of_week}:${slot.time_of_day}`));
      setPreferredVenues(
        preferred
          .filter((item) => item.venue)
          .map((item) => ({
            id: item.venue_id,
            name: item.venue?.name ?? 'Unknown Venue',
            address: item.venue?.address ?? '',
            average_rating: item.venue?.average_rating ?? 0,
          })),
      );
      setAvatarPreview(profile.avatar_url);
      setCoverPreview(profile.cover_url);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!venueQuery.trim()) {
      setVenueResults([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const results = await searchPreferredVenueOptions(venueQuery);
      setVenueResults(results.filter((result) => !preferredVenues.some((item) => item.id === result.id)));
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [venueQuery, preferredVenues]);

  if (!profile) return null;

  function toggleArrayValue(value: string, current: string[], setter: (next: string[]) => void) {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function toggleAvailability(dayIndex: number, timeOfDay: typeof TIMES[number]) {
    const key = `${dayIndex}:${timeOfDay}`;
    setSelectedAvailability((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  async function handleSave() {
    if (!username || username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    let avatarUrl = profile.avatar_url;
    let coverUrl = profile.cover_url;

    if (avatarFile) {
      avatarUrl = await uploadProfileImage(profile.id, avatarFile, 'avatar');
      if (!avatarUrl) {
        setError('Failed to upload avatar.');
        setIsSaving(false);
        return;
      }
    }

    if (coverFile) {
      coverUrl = await uploadProfileImage(profile.id, coverFile, 'cover');
      if (!coverUrl) {
        setError('Failed to upload cover photo.');
        setIsSaving(false);
        return;
      }
    }

    const availabilityPayload = selectedAvailability.map((item) => {
      const [day, time] = item.split(':');
      return {
        day_of_week: Number(day),
        time_of_day: time as typeof TIMES[number],
      };
    });

    const [profileOk, availabilityOk, venuesOk] = await Promise.all([
      updateProfile(profile.id, {
        username,
        full_name: fullName.trim(),
        bio: bio.trim() || null,
        city: city.trim() || null,
        date_of_birth: dateOfBirth || null,
        skill_level: skillLevel ? (skillLevel as typeof SKILLS[number]) : null,
        playing_styles: playingStyles,
        grips,
        techniques,
        profile_visibility: profileVisibility,
        show_location: showLocation,
        show_online_status: showOnlineStatus,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
      }),
      syncUserAvailability(profile.id, availabilityPayload),
      syncPreferredVenues(profile.id, preferredVenues.map((item) => item.id)),
    ]);

    if (!profileOk || !availabilityOk || !venuesOk) {
      setError('Failed to save one or more profile sections.');
      setIsSaving(false);
      return;
    }

    await refreshProfile();
    setIsSaving(false);
    onBack();
  }

  return (
    <div className="min-h-full bg-gray-50 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom)+100px)]">
      <div className="px-5 mb-6 flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-700 transition-colors hover:bg-gray-50">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-semibold text-xl text-gray-900">Edit Profile</h1>
        <div className="w-10" />
      </div>

      <div className="px-5 space-y-6">
        {error ? <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div> : null}

        <Panel title="Photos">
          <div className="grid grid-cols-2 gap-4">
            <ImagePicker label="Avatar" preview={avatarPreview} onChange={(file) => {
              setAvatarFile(file);
              setAvatarPreview(URL.createObjectURL(file));
            }} />
            <ImagePicker label="Cover" preview={coverPreview} onChange={(file) => {
              setCoverFile(file);
              setCoverPreview(URL.createObjectURL(file));
            }} />
          </div>
        </Panel>

        <Panel title="Basic Info">
          <div className="space-y-4">
            <Input label="Username" value={username} onChange={(value) => setUsername(normalizeUsername(value))} />
            <Input label="Full Name" value={fullName} onChange={setFullName} />
            <Input label="City" value={city} onChange={setCity} />
            <Input label="Date of Birth" type="date" value={dateOfBirth} onChange={setDateOfBirth} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value.slice(0, 150))}
                rows={4}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                placeholder="Tell players how you like to play."
              />
            </div>
          </div>
        </Panel>

        <Panel title="Skill & Style">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Skill Level</label>
              <select
                value={skillLevel}
                onChange={(event) => setSkillLevel(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400 appearance-none bg-no-repeat"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundPosition: `right 1rem center`,
                  backgroundSize: `1.2em 1.2em`
                }}
              >
                <option value="">Select skill</option>
                {SKILLS.map((skill) => (
                  <option key={skill} value={skill}>{skill}</option>
                ))}
              </select>
            </div>
            <ChoiceRow label="Playing Styles" items={STYLES} selected={playingStyles} onToggle={(value) => toggleArrayValue(value, playingStyles, setPlayingStyles)} />
            <ChoiceRow label="Grips" items={GRIPS} selected={grips} onToggle={(value) => toggleArrayValue(value, grips, setGrips)} />
            <ChoiceRow label="Techniques" items={TECHNIQUES} selected={techniques} onToggle={(value) => toggleArrayValue(value, techniques, setTechniques)} />
          </div>
        </Panel>

        <Panel title="Availability">
          <div className="space-y-6">
            {DAYS.map((day, dayIndex) => (
              <div key={day}>
                <p className="block text-sm font-medium text-gray-700 mb-2.5">{day}</p>
                <div className="flex flex-wrap gap-2">
                  {TIMES.map((time) => {
                    const key = `${dayIndex}:${time}`;
                    const isActive = selectedAvailability.includes(key);
                    return (
                      <button
                        key={time}
                        onClick={() => toggleAvailability(dayIndex, time)}
                        className={`px-3.5 py-2.5 rounded-xl border text-sm font-medium capitalize transition-colors ${isActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Preferred Venues">
          <div className="space-y-4">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={venueQuery}
                onChange={(event) => setVenueQuery(event.target.value)}
                placeholder="Search venues"
                className="w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              />
            </div>

            {venueResults.length > 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                {venueResults.map((venue) => (
                  <button
                    key={venue.id}
                    onClick={() => {
                      setPreferredVenues((current) => [...current, venue]);
                      setVenueQuery('');
                      setVenueResults([]);
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between text-left border-b last:border-b-0 border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm text-gray-900">{venue.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{venue.address}</p>
                    </div>
                    <Plus size={18} className="text-gray-900" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {preferredVenues.map((venue) => (
                <span key={venue.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-sm font-medium text-gray-700">
                  {venue.name}
                  <button onClick={() => setPreferredVenues((current) => current.filter((item) => item.id !== venue.id))} className="text-gray-500 hover:text-gray-900 transition-colors rounded-full overflow-hidden flex items-center justify-center p-0.5">
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Privacy">
          <div className="space-y-4">
            <ToggleRow label="Profile visibility" description={profileVisibility === 'public' ? 'Public profile' : 'Connections only'} checked={profileVisibility === 'public'} onChange={(checked) => setProfileVisibility(checked ? 'public' : 'connections_only')} />
            <ToggleRow label="Show location" description="Allow other players to see your city and distance." checked={showLocation} onChange={setShowLocation} />
            <ToggleRow label="Show online status" description="Display your online indicator in chat and profiles." checked={showOnlineStatus} onChange={setShowOnlineStatus} />
          </div>
        </Panel>

        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="w-full rounded-2xl bg-gray-900 text-white px-5 py-4 font-semibold shadow-sm transition-transform active:scale-[0.98] hover:bg-gray-800 disabled:opacity-60 disabled:active:scale-100"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h3 className="font-semibold text-lg text-gray-900 mb-5">{title}</h3>
      {children}
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
      />
    </div>
  );
}

function ImagePicker({
  label,
  preview,
  onChange,
}: {
  label: string;
  preview: string | null;
  onChange: (file: File) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">{label}</span>
      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 h-36 flex items-center justify-center transition-colors hover:bg-gray-100 cursor-pointer">
        {preview ? <img src={preview} alt={label} className="w-full h-full object-cover" /> : <span className="text-sm text-gray-500 font-medium">Choose image</span>}
      </div>
      <input type="file" accept="image/*" className="hidden" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onChange(file);
      }} />
    </label>
  );
}

function ChoiceRow({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="block text-sm font-medium text-gray-700 mb-2.5">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = selected.includes(item);
          return (
            <button
              key={item}
              onClick={() => onToggle(item)}
              className={`px-3.5 py-2 rounded-xl border text-sm font-medium capitalize transition-colors ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              {item.replace(/_/g, ' ')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3.5">
      <div>
        <p className="font-medium text-sm text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-12 h-7 rounded-full transition-colors ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
      >
        <span className={`block w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}