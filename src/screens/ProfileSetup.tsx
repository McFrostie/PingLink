// src/screens/ProfileSetup.tsx
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera, MapPin, Calendar, User, ArrowRight, ArrowLeft,
  Target, Activity, Zap, Star, Trophy, Check, Loader2, AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface ProfileSetupProps {
  key?: string;
  onComplete: () => void;
}

// ── Static data ──────────────────────────────────────────────────────────────

const skillLevels = [
  { id: 'beginner',     label: 'Beginner',     desc: 'Just starting out, learning the basics.',      icon: Target  },
  { id: 'casual',       label: 'Casual',       desc: 'Plays occasionally for fun.',                  icon: Activity },
  { id: 'intermediate', label: 'Intermediate', desc: 'Consistent rallies, basic spin control.',      icon: Zap     },
  { id: 'advanced',     label: 'Advanced',     desc: 'Strong technique, strategic gameplay.',        icon: Star    },
  { id: 'professional', label: 'Professional', desc: 'Highly competitive, tournament player.',       icon: Trophy  },
];

const styleOptions = ['Offensive', 'Defensive', 'All-Round'];
const gripOptions  = ['Penhold', 'Shakehand'];
const techOptions  = ['Heavy Topspin', 'Chopper', 'Looper', 'Blocker'];

const dayOptions = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const timeOptions = [
  { id: 'morning',   label: 'Morning',   desc: '6am – 12pm' },
  { id: 'afternoon', label: 'Afternoon', desc: '12pm – 5pm' },
  { id: 'evening',   label: 'Evening',   desc: '5pm – 9pm'  },
  { id: 'night',     label: 'Night',     desc: '9pm+'        },
];

// ── Value transformers (UI → DB) ─────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

function toDbStyle(s: string): string {
  return s.toLowerCase().replace(/-/g, '_').replace(/ /g, '_');
  // 'All-Round' → 'all_round', 'Heavy Topspin' → 'heavy_topspin'
}

// ── Username validation ───────────────────────────────────────────────────────

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

function validateUsername(value: string): string | null {
  if (value.length < 3)  return 'Username must be at least 3 characters.';
  if (value.length > 30) return 'Username must be 30 characters or fewer.';
  if (!USERNAME_REGEX.test(value))
    return 'Only lowercase letters, numbers, and underscores allowed.';
  return null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const session = useAuthStore((s) => s.session);
  const [step, setStep] = useState(1);

  // Step 1 state
  const [username,  setUsername]  = useState('');
  const [dob,       setDob]       = useState('');
  const [city,      setCity]      = useState('');

  // Step 2 state
  const [skill, setSkill] = useState('');

  // Step 3 state
  const [styles,     setStyles]     = useState<string[]>([]);
  const [grips,      setGrips]      = useState<string[]>([]);
  const [techniques, setTechniques] = useState<string[]>([]);

  // Step 4 state
  const [days,  setDays]  = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);

  // Avatar state
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Revoke preview object URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  // Save state
  const [isSaving,       setIsSaving]       = useState(false);
  const [saveError,      setSaveError]      = useState<string | null>(null);
  const [usernameError,  setUsernameError]  = useState<string | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const toggleSelection = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    list: string[],
    item: string,
  ) => {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const isStepValid = (): boolean => {
    if (step === 1) return username.trim().length >= 3 && dob !== '' && city.trim() !== '';
    if (step === 2) return skill !== '';
    if (step === 3) return styles.length > 0 || grips.length > 0 || techniques.length > 0;
    return true; // Step 4 (availability) is optional
  };

  const handleNextStep = () => {
    if (step === 1) {
      const err = validateUsername(username.trim().toLowerCase());
      if (err) { setUsernameError(err); return; }
      setUsernameError(null);
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  // ── Save handler ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!session?.user) {
      setSaveError('Session expired. Please sign in again.');
      return;
    }

    const userId = session.user.id;
    setSaveError(null);
    setIsSaving(true);

    try {
      // 1. Upload avatar to Supabase Storage (if user chose one)
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const path = `${userId}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }

      // 2. Update profiles row (created by handle_new_user trigger on signup)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username:       username.trim().toLowerCase(),
          date_of_birth:  dob || null,
          city:           city.trim() || null,
          skill_level:    skill,
          playing_styles: styles.map(toDbStyle),
          grips:          grips.map(toDbStyle),
          techniques:     techniques.map(toDbStyle),
          setup_complete: true,
          updated_at:     new Date().toISOString(),
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        })
        .eq('id', userId);

      if (profileError) {
        // Postgres unique constraint on username → code '23505'
        if (profileError.code === '23505') {
          setUsernameError('That username is already taken. Please choose another.');
          setStep(1); // send them back to step 1 to pick a new username
          setIsSaving(false);
          return;
        }
        throw profileError;
      }

      // 3. Clear any previous availability rows (safe re-run)
      await supabase
        .from('user_availability')
        .delete()
        .eq('user_id', userId);

      // 4. Insert new availability rows (only if user selected any)
      if (days.length > 0 && times.length > 0) {
        const availabilityRows = days.flatMap((day) =>
          times.map((time) => ({
            user_id:    userId,
            day_of_week: DAY_MAP[day],
            time_of_day: time,
          }))
        );

        const { error: availError } = await supabase
          .from('user_availability')
          .insert(availabilityRows);

        if (availError) throw availError;
      }

      // 5. Done — tell App.tsx to re-fetch the profile.
      //    refreshProfile() will return setup_complete = true,
      //    which makes App.tsx route to MainShell automatically.
      onComplete();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile. Please try again.';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Sub-component ────────────────────────────────────────────────────────

  const Chip = ({
    label, selected, onClick, disabled,
  }: { key?: string; label: string; selected: boolean; onClick: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border-2 disabled:opacity-50 ${
        selected
          ? 'bg-ping/10 border-ping text-ping shadow-sm'
          : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full bg-white relative overflow-hidden pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="absolute top-0 right-0 w-64 h-64 bg-ping/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      {/* Header & progress bar */}
      <div className="px-6 mb-2 z-10 flex-shrink-0 relative pt-1">
        <div className="flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => Math.max(s - 1, 1))}
              disabled={isSaving}
              className="w-10 h-10 flex items-center justify-center bg-white border-2 border-gray-100 rounded-2xl text-black hover:border-black hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
            </button>
          ) : (
            <div className="w-10 h-10" />
          )}
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-black' : i < step ? 'w-2 bg-black' : 'w-2 bg-gray-200'
                }`}
              />
            ))}
          </div>
          <div className="w-10 h-10" />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 relative z-10">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Basic info ───────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="pt-2 pb-6"
            >
              <h2 className="text-4xl font-display font-bold text-black mb-3 tracking-tight">Basic info</h2>
              <p className="text-gray-500 text-base font-medium mb-8">Let's set up your profile</p>

              {/* Avatar upload */}
              <div className="flex flex-col items-center mb-8">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative w-28 h-28 rounded-full bg-gray-50 flex items-center justify-center overflow-hidden mb-2 border-2 border-gray-100 shadow-sm hover:border-gray-300 active:scale-95 transition-all group"
                >
                  {avatarPreview ? (
                    <>
                      <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera size={24} className="text-white" strokeWidth={2} />
                      </div>
                    </>
                  ) : (
                    <Camera size={32} className="text-gray-400 group-hover:text-gray-600 transition-colors" strokeWidth={1.5} />
                  )}
                </button>
                <p className="text-xs text-gray-400 font-medium">
                  {avatarPreview ? 'Tap to change photo' : 'Add photo (optional)'}
                </p>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div className="space-y-5">
                {/* Username */}
                <div className="space-y-1">
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors z-10 pointer-events-none">
                      <User size={20} strokeWidth={2.5} />
                    </div>
                    <input
                      type="text"
                      placeholder="Username (e.g. pingking_99)"
                      className={`ping-input pl-12 ${usernameError ? 'border-red-400' : ''}`}
                      value={username}
                      onChange={(e) => {
                        // Force lowercase as they type
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                        setUsernameError(null);
                      }}
                      autoComplete="username"
                    />
                  </div>
                  {usernameError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-500 font-medium flex items-center gap-1.5 pl-1"
                    >
                      <AlertCircle size={13} /> {usernameError}
                    </motion.p>
                  )}
                  <p className="text-xs text-gray-400 font-medium pl-1">
                    Lowercase letters, numbers, underscores. 3–30 chars.
                  </p>
                </div>

                {/* Date of birth */}
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors z-10 pointer-events-none">
                    <Calendar size={20} strokeWidth={2.5} />
                  </div>
                  <input
                    type="date"
                    className="ping-input pl-12 text-gray-700"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>

                {/* City */}
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors z-10 pointer-events-none">
                    <MapPin size={20} strokeWidth={2.5} />
                  </div>
                  <input
                    type="text"
                    placeholder="City (e.g. Seattle)"
                    className="ping-input pl-12"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Skill level ──────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="pt-2 pb-6"
            >
              <h2 className="text-4xl font-display font-bold text-black mb-3 tracking-tight">Skill level</h2>
              <p className="text-gray-500 text-base font-medium mb-6">How would you describe your game?</p>
              <div className="space-y-3">
                {skillLevels.map((lvl) => {
                  const Icon = lvl.icon;
                  const isSelected = skill === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      onClick={() => setSkill(lvl.id)}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-center gap-4 ${
                        isSelected ? 'bg-ping/5 border-ping shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-ping text-white shadow-md shadow-ping/20' : 'bg-gray-100 text-gray-500'}`}>
                        <Icon size={24} strokeWidth={isSelected ? 2.5 : 2} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-black text-base">{lvl.label}</h3>
                        <p className="text-sm text-gray-500 mt-0.5 font-medium">{lvl.desc}</p>
                      </div>
                      {isSelected && <Check size={24} strokeWidth={3} className="text-ping" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Playing style ────────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="pt-2 pb-6"
            >
              <h2 className="text-4xl font-display font-bold text-black mb-3 tracking-tight">Playing style</h2>
              <p className="text-gray-500 text-base font-medium mb-6">Select all that apply</p>
              <div className="space-y-8">
                <div>
                  <h3 className="font-bold text-sm text-gray-900 mb-3 uppercase tracking-wider">Style</h3>
                  <div className="flex flex-wrap gap-2.5">
                    {styleOptions.map((opt) => (
                      <Chip key={opt} label={opt} selected={styles.includes(opt)} onClick={() => toggleSelection(setStyles, styles, opt)} />
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 mb-3 uppercase tracking-wider">Grip</h3>
                  <div className="flex flex-wrap gap-2.5">
                    {gripOptions.map((opt) => (
                      <Chip key={opt} label={opt} selected={grips.includes(opt)} onClick={() => toggleSelection(setGrips, grips, opt)} />
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 mb-3 uppercase tracking-wider">Technique</h3>
                  <div className="flex flex-wrap gap-2.5">
                    {techOptions.map((opt) => (
                      <Chip key={opt} label={opt} selected={techniques.includes(opt)} onClick={() => toggleSelection(setTechniques, techniques, opt)} />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Availability ─────────────────────────────────── */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="pt-2 pb-6"
            >
              <h2 className="text-4xl font-display font-bold text-black mb-3 tracking-tight">Availability</h2>
              <p className="text-gray-500 text-base font-medium mb-6">When do you usually play? (optional)</p>
              <div className="space-y-8">
                <div>
                  <h3 className="font-bold text-sm text-gray-900 mb-3 uppercase tracking-wider">Days</h3>
                  <div className="flex flex-wrap gap-2.5">
                    {dayOptions.map((day) => (
                      <button
                        key={day}
                        onClick={() => toggleSelection(setDays, days, day)}
                        disabled={isSaving}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-200 border-2 disabled:opacity-50 ${
                          days.includes(day)
                            ? 'bg-ping/10 border-ping text-ping shadow-sm'
                            : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {day.charAt(0)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 mb-3 uppercase tracking-wider">Time of Day</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {timeOptions.map((time) => (
                      <button
                        key={time.id}
                        onClick={() => toggleSelection(setTimes, times, time.id)}
                        disabled={isSaving}
                        className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 disabled:opacity-50 ${
                          times.includes(time.id)
                            ? 'bg-ping/5 border-ping shadow-sm'
                            : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <h4 className={`font-bold text-base ${times.includes(time.id) ? 'text-ping' : 'text-gray-900'}`}>{time.label}</h4>
                        <p className={`text-xs mt-1 font-medium ${times.includes(time.id) ? 'text-ping/70' : 'text-gray-500'}`}>{time.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-6 pt-4 flex-shrink-0 bg-white border-t border-gray-100 relative z-10 space-y-3">
        {/* Save error (Step 4 only) */}
        {step === 4 && saveError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-500 font-medium text-center flex items-center justify-center gap-1.5"
          >
            <AlertCircle size={14} /> {saveError}
          </motion.p>
        )}

        {step < 4 ? (
          <button
            onClick={handleNextStep}
            disabled={!isStepValid()}
            className="ping-btn disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue <ArrowRight size={20} strokeWidth={2.5} />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="ping-btn disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 size={20} className="animate-spin" /> : null}
            {isSaving ? 'Saving your profile…' : 'Finish setup'}
            {!isSaving && <ArrowRight size={20} strokeWidth={2.5} />}
          </button>
        )}
      </div>
    </div>
  );
}
