import { useEffect, useState } from 'react';
import { ArrowLeft, LogOut, Shield, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { resetAllStores } from '../stores/resetStores';
import {
  deleteMyAccount,
  fetchNotificationPreferences,
  updateNotificationPreferences,
  updateProfile,
} from '../lib/queries/profile';
import type { NotificationPreferences } from '../lib/types';

export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const profile = useAuthStore((state) => state.profile);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const logout = useAuthStore((state) => state.logout);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null);
  const [privacy, setPrivacy] = useState({
    profile_visibility: 'public' as 'public' | 'connections_only',
    show_location: true,
    show_online_status: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    setPrivacy({
      profile_visibility: profile.profile_visibility,
      show_location: profile.show_location,
      show_online_status: profile.show_online_status,
    });

    fetchNotificationPreferences(profile.id).then(setNotificationPrefs);
  }, [profile?.id]);

  if (!profile) return null;

  async function handleSavePrivacy() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    const ok = await updateProfile(profile.id, privacy);
    if (!ok) {
      setError('Failed to save privacy settings.');
      setIsSaving(false);
      return;
    }

    await refreshProfile();
    setMessage('Privacy settings updated.');
    setIsSaving(false);
  }

  async function handleUpdateEmail() {
    if (!email.trim()) return;
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase.auth.updateUser({ email: email.trim() });
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage('Check your inbox to confirm the new email address.');
    setEmail('');
  }

  async function handleUpdatePassword() {
    if (!password.trim()) return;
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase.auth.updateUser({ password: password.trim() });
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage('Password updated successfully.');
    setPassword('');
  }

  async function handleTogglePreference(key: keyof Omit<NotificationPreferences, 'user_id'>) {
    if (!notificationPrefs) return;

    const next = {
      ...notificationPrefs,
      [key]: !notificationPrefs[key],
    };

    setNotificationPrefs(next);
    const ok = await updateNotificationPreferences(profile.id, { [key]: next[key] });
    if (!ok) {
      setNotificationPrefs(notificationPrefs);
      setError('Failed to update notification preferences.');
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm('Delete your account permanently? This cannot be undone.');
    if (!confirmed) return;

    setIsSaving(true);
    setError(null);

    const ok = await deleteMyAccount();
    if (!ok) {
      setError('Failed to delete account.');
      setIsSaving(false);
      return;
    }

    await supabase.auth.signOut({ scope: 'local' });
    resetAllStores();
    window.location.reload();
  }

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setError(null);
    setMessage(null);

    try {
      await logout();
      resetAllStores();
    } catch {
      setError('Failed to sign out. Please try again.');
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="min-h-full bg-gray-50 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom)+100px)]">
      {/* Header */}
      <div className="px-5 mb-6 flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-700 transition-colors hover:bg-gray-50">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-semibold text-xl text-gray-900">Settings</h1>
        <div className="w-10" />
      </div>

      <div className="px-5 space-y-6">
        {message ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 font-medium">{message}</div>
        ) : null}
        {error ? (
          <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 font-medium">{error}</div>
        ) : null}

        {/* Account */}
        <Section title="Account">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="new@email.com"
                  className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                />
                <button
                  onClick={handleUpdateEmail}
                  className="shrink-0 rounded-2xl bg-gray-900 text-white px-4 py-3 text-sm font-semibold transition-colors hover:bg-gray-800 active:scale-95"
                >
                  Update
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                />
                <button
                  onClick={handleUpdatePassword}
                  className="shrink-0 rounded-2xl bg-gray-900 text-white px-4 py-3 text-sm font-semibold transition-colors hover:bg-gray-800 active:scale-95"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* Privacy */}
        <Section title="Privacy">
          <div className="space-y-3">
            <ToggleRow
              label="Public profile"
              description="Limit your profile to accepted connections only."
              checked={privacy.profile_visibility === 'public'}
              onChange={(checked) => setPrivacy((current) => ({
                ...current,
                profile_visibility: checked ? 'public' : 'connections_only',
              }))}
            />
            <ToggleRow
              label="Show location"
              description="Display your city on discovery surfaces."
              checked={privacy.show_location}
              onChange={(checked) => setPrivacy((current) => ({ ...current, show_location: checked }))}
            />
            <ToggleRow
              label="Show online status"
              description="Let connections see when you're active."
              checked={privacy.show_online_status}
              onChange={(checked) => setPrivacy((current) => ({ ...current, show_online_status: checked }))}
            />
            <button
              onClick={handleSavePrivacy}
              disabled={isSaving}
              className="w-full mt-1 rounded-2xl bg-gray-900 text-white px-4 py-3 text-sm font-semibold transition-colors hover:bg-gray-800 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
            >
              {isSaving ? 'Saving...' : 'Save Privacy Settings'}
            </button>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <div className="divide-y divide-gray-100">
            <NotifRow label="Match requests" checked={notificationPrefs?.match_requests ?? true} onChange={() => handleTogglePreference('match_requests')} />
            <NotifRow label="Connection requests" checked={notificationPrefs?.connection_requests ?? true} onChange={() => handleTogglePreference('connection_requests')} />
            <NotifRow label="Messages" checked={notificationPrefs?.messages ?? true} onChange={() => handleTogglePreference('messages')} />
            <NotifRow label="Community activity" checked={notificationPrefs?.community_activity ?? true} onChange={() => handleTogglePreference('community_activity')} />
            <NotifRow label="Venue updates" checked={notificationPrefs?.venue_updates ?? true} onChange={() => handleTogglePreference('venue_updates')} />
          </div>
        </Section>

        {/* About */}
        <Section title="About">
          <div className="divide-y divide-gray-100">
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-gray-700 font-medium">App</span>
              <span className="text-sm text-gray-500">PingLink</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-gray-700 font-medium">Version</span>
              <span className="text-sm text-gray-500">0.1.0</span>
            </div>
          </div>
        </Section>

        {/* Session */}
        <Section title="Session">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut || isSaving}
            className="w-full rounded-2xl border border-gray-200 bg-white text-gray-900 px-5 py-3.5 flex items-center justify-center gap-2.5 font-semibold text-sm transition-colors hover:bg-gray-50 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
          >
            <LogOut size={16} className="text-gray-600" />
            {isLoggingOut ? 'Signing out...' : 'Log out'}
          </button>
        </Section>

        {/* Danger Zone */}
        <Section title="Danger Zone">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700 leading-relaxed flex items-start gap-2 mb-4">
            <Shield size={14} className="mt-0.5 shrink-0" />
            <span>Deleting your account is permanent and cannot be undone. All data associated with your profile will be removed.</span>
          </div>
          <button
            onClick={handleDeleteAccount}
            disabled={isSaving}
            className="w-full rounded-2xl bg-red-600 text-white px-5 py-3.5 flex items-center justify-center gap-2 font-semibold text-sm transition-colors hover:bg-red-700 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
          >
            <Trash2 size={16} />
            Delete my account
          </button>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h3 className="font-semibold text-lg text-gray-900 mb-5">{title}</h3>
      {children}
    </section>
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
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900">{label}</p>
        {description ? <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p> : null}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-12 h-7 rounded-full transition-colors ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
      >
        <span className={`block w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function NotifRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <button
        onClick={onChange}
        className={`shrink-0 w-12 h-7 rounded-full transition-colors ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
      >
        <span className={`block w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}