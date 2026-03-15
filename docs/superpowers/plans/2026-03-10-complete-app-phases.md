# PingLink — Complete App Implementation Plan (Phases 2–7)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire every UI screen in PingLink from mock data to live Supabase data, add Google Maps venue discovery, real-time messaging, match scheduling, and a full profile/settings system — resulting in a shippable Android APK.

**Architecture:** Custom `useState` routing in `App.tsx` + `MainShell.tsx` (NO React Router). Each feature gets its own Zustand store in `src/stores/`. Supabase queries live in `src/lib/queries/` — thin functions that return typed data, imported by stores. `@capacitor/geolocation` for location. `@capacitor/google-maps` for native Android map. Supabase Storage for photo uploads.

**Tech Stack:** React 19 + TypeScript + Vite + Capacitor 8 (Android), Zustand v5, `@supabase/supabase-js` v2, `@capacitor/geolocation`, `@capacitor/google-maps`, Tailwind CSS 4, motion/react, lucide-react.

---

## Screen → Phase Reference

| Screen | Phase | Tables |
|---|---|---|
| HomeFeed (live data) | 2 | `profiles`, `activity_feed`, `matches`, `user_venue_checkins`, `venues` |
| MapScreen (Google Maps) | 3 | `venues`, `venue_photos`, `user_venue_checkins` |
| VenueFilter | 3 | `venues` |
| VenueDetail | 3 | `venues`, `venue_photos`, `venue_reviews`, `user_venue_checkins`, `profiles` |
| AddVenue | 3 | `venues`, `venue_photos` (+ Storage) |
| PlayerSearch | 4 | `profiles`, `connections` |
| PlayerProfile | 4 | `profiles`, `user_availability`, `connections`, `user_preferred_venues`, `activity_feed` |
| ConnectionsList | 4 | `connections`, `profiles` |
| Notifications | 4 | `notifications` |
| MessagesInbox | 5 | `conversations`, `messages`, `profiles` |
| ChatScreen | 5 | `messages` (Realtime) |
| MatchScheduling | 6 | `matches`, `match_players`, `venues`, `profiles` |
| MatchDetail | 6 | `matches`, `match_players`, `venues`, `profiles` |
| MyProfile | 7 | `profiles`, `user_availability`, `user_preferred_venues`, `activity_feed` |
| EditProfile | 7 | `profiles`, `user_availability`, `user_preferred_venues` |
| Settings | 7 | `profiles` (visibility/privacy cols) |

---

## Chunk 1: Phase 2 — Location Service + Live HomeFeed

### Task 1: Install @capacitor/geolocation

**Files:**
- Modify: `package.json`
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Install the plugin**

```bash
npm install @capacitor/geolocation
npx cap sync android
```

- [ ] **Step 2: Add Android permissions to AndroidManifest.xml**

Inside `<manifest>`, before `<application>`:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-feature android:name="android.hardware.location.gps" />
```

- [ ] **Step 3: Verify plugin is importable**

In browser dev tools or `npm run lint` — confirm no type errors on `import { Geolocation } from '@capacitor/geolocation'`.

---

### Task 2: Create locationStore.ts

**Files:**
- Create: `src/stores/locationStore.ts`
- Modify: `src/stores/resetStores.ts`

- [ ] **Step 1: Create the store**

```typescript
// src/stores/locationStore.ts
import { create } from 'zustand';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '../lib/supabase';

interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface LocationState {
  coords: Coords | null;
  permissionStatus: 'unknown' | 'granted' | 'denied' | 'prompt';
  isLocating: boolean;
  error: string | null;
  requestAndFetch: (userId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  coords: null as Coords | null,
  permissionStatus: 'unknown' as const,
  isLocating: false,
  error: null as string | null,
};

export const useLocationStore = create<LocationState>()((set) => ({
  ...initialState,

  requestAndFetch: async (userId: string) => {
    set({ isLocating: true, error: null });
    try {
      // Check/request permission
      const perm = await Geolocation.checkPermissions();
      if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          set({ permissionStatus: 'denied', isLocating: false });
          return;
        }
      }
      if (perm.location === 'denied') {
        set({ permissionStatus: 'denied', isLocating: false });
        return;
      }

      set({ permissionStatus: 'granted' });

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      const coords: Coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      set({ coords, isLocating: false });

      // Persist to Supabase profiles row (fire-and-forget)
      await supabase
        .from('profiles')
        .update({
          latitude: coords.latitude,
          longitude: coords.longitude,
          last_seen_at: new Date().toISOString(),
          is_online: true,
        })
        .eq('id', userId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Location unavailable';
      set({ isLocating: false, error: msg });
    }
  },

  reset: () => set(initialState),
}));
```

- [ ] **Step 2: Add reset to resetStores.ts**

Open `src/stores/resetStores.ts` and import + call `useLocationStore.getState().reset()` inside `resetAllStores()`.

---

### Task 3: Trigger location fetch on app open

**Files:**
- Modify: `src/components/AuthProvider.tsx`

The location fetch must run **after** the user session is confirmed (i.e., when `INITIAL_SESSION` fires with a valid user and `setup_complete = true`). Add a call inside `handleAuthEvent` after it resolves, only when `setup_complete` is true.

- [ ] **Step 1: Update AuthProvider.tsx**

After `await store.handleAuthEvent(event, session)` resolves inside the `setTimeout`, add:

```typescript
import { useLocationStore } from '../stores/locationStore';

// Inside the setTimeout callback, after handleAuthEvent:
const updatedProfile = useAuthStore.getState().profile;
if (updatedProfile?.setup_complete && updatedProfile.id) {
  useLocationStore.getState().requestAndFetch(updatedProfile.id);
}
```

Also hook into Capacitor's `App.addListener('appStateChange')` — on `isActive: true`, re-fetch location:

```typescript
import { App as CapacitorApp } from '@capacitor/app';

// Inside AuthProvider useEffect:
const appStateListener = CapacitorApp.addListener('appStateChange', (state) => {
  if (state.isActive) {
    const { profile } = useAuthStore.getState();
    if (profile?.setup_complete && profile.id) {
      useLocationStore.getState().requestAndFetch(profile.id);
    }
  }
});

return () => {
  subscription.unsubscribe();
  appStateListener.then(l => l.remove());
};
```

- [ ] **Step 2: Verify location updates in Supabase**

Run `npm run dev`, log in, open the Supabase dashboard → Table Editor → `profiles`, confirm `latitude`/`longitude`/`last_seen_at` are updated.

- [ ] **Step 3: Commit**

```bash
git add src/stores/locationStore.ts src/stores/resetStores.ts src/components/AuthProvider.tsx android/app/src/main/AndroidManifest.xml
git commit -m "feat: add location service with @capacitor/geolocation, persist to profiles"
```

---

### Task 4: Create Supabase query helpers

**Files:**
- Create: `src/lib/queries/feed.ts`
- Create: `src/lib/queries/profile.ts`

These are pure async functions — no Zustand, no React — so they are easy to test and reuse.

- [ ] **Step 1: Create feed.ts**

```typescript
// src/lib/queries/feed.ts
import { supabase } from '../supabase';

export interface FeedActivity {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_avatar: string | null;
  activity_type: string;
  subject_type: string | null;
  subject_id: string | null;
  venue_name?: string;
  created_at: string;
}

export interface FeedMatch {
  id: string;
  title: string;
  match_type: string;
  skill_level: string;
  scheduled_at: string;
  venue_id: string | null;
  venue_name: string | null;
  max_players: number;
  player_count: number;
  players: Array<{ id: string; full_name: string; avatar_url: string | null }>;
}

/** Activity feed for current user — includes connections' check-ins, matches, etc. */
export async function fetchActivityFeed(userId: string, limit = 20): Promise<FeedActivity[]> {
  const { data, error } = await supabase
    .from('activity_feed')
    .select(`
      id,
      activity_type,
      subject_type,
      subject_id,
      created_at,
      actor:profiles!activity_feed_actor_id_fkey(id, full_name, avatar_url)
    `)
    .or(`actor_id.eq.${userId},audience.cs.{${userId}}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    id: row.id,
    actor_id: row.actor?.id ?? '',
    actor_name: row.actor?.full_name ?? 'Unknown',
    actor_avatar: row.actor?.avatar_url ?? null,
    activity_type: row.activity_type,
    subject_type: row.subject_type,
    subject_id: row.subject_id,
    created_at: row.created_at,
  }));
}

/** Upcoming open matches — joinable by current user */
export async function fetchUpcomingMatches(limit = 10): Promise<FeedMatch[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('matches')
    .select(`
      id,
      title,
      match_type,
      skill_level,
      scheduled_at,
      max_players,
      venue:venues(id, name),
      match_players(
        player:profiles!match_players_player_id_fkey(id, full_name, avatar_url)
      )
    `)
    .eq('status', 'open')
    .gte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    id: row.id,
    title: row.title,
    match_type: row.match_type,
    skill_level: row.skill_level,
    scheduled_at: row.scheduled_at,
    venue_id: row.venue?.id ?? null,
    venue_name: row.venue?.name ?? null,
    max_players: row.max_players,
    player_count: row.match_players?.length ?? 0,
    players: (row.match_players ?? []).map((mp: any) => ({
      id: mp.player?.id ?? '',
      full_name: mp.player?.full_name ?? '',
      avatar_url: mp.player?.avatar_url ?? null,
    })),
  }));
}

/** Recent check-ins from connections */
export async function fetchConnectionCheckins(userId: string, limit = 5) {
  const { data, error } = await supabase
    .from('user_venue_checkins')
    .select(`
      id,
      checked_in_at,
      user:profiles!user_venue_checkins_user_id_fkey(id, full_name, avatar_url),
      venue:venues(id, name)
    `)
    .order('checked_in_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as any[]).map((row) => ({
    id: row.id,
    checked_in_at: row.checked_in_at,
    user_id: row.user?.id,
    user_name: row.user?.full_name ?? 'Unknown',
    user_avatar: row.user?.avatar_url ?? null,
    venue_id: row.venue?.id,
    venue_name: row.venue?.name ?? 'Unknown Venue',
  }));
}
```

- [ ] **Step 2: Create profile.ts**

```typescript
// src/lib/queries/profile.ts
import { supabase } from '../supabase';
import type { Profile } from '../types';

export async function fetchProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Profile;
}
```

---

### Task 5: Create homeFeedStore.ts

**Files:**
- Create: `src/stores/homeFeedStore.ts`

```typescript
// src/stores/homeFeedStore.ts
import { create } from 'zustand';
import {
  fetchActivityFeed,
  fetchUpcomingMatches,
  fetchConnectionCheckins,
  type FeedActivity,
  type FeedMatch,
} from '../lib/queries/feed';

interface CheckinItem {
  id: string;
  checked_in_at: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  venue_id: string;
  venue_name: string;
}

interface HomeFeedState {
  activities: FeedActivity[];
  matches: FeedMatch[];
  checkins: CheckinItem[];
  isLoading: boolean;
  error: string | null;
  fetchAll: (userId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  activities: [] as FeedActivity[],
  matches: [] as FeedMatch[],
  checkins: [] as CheckinItem[],
  isLoading: false,
  error: null as string | null,
};

export const useHomeFeedStore = create<HomeFeedState>()((set) => ({
  ...initialState,

  fetchAll: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const [activities, matches, checkins] = await Promise.all([
        fetchActivityFeed(userId),
        fetchUpcomingMatches(),
        fetchConnectionCheckins(userId),
      ]);
      set({ activities, matches, checkins, isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load feed';
      set({ isLoading: false, error: msg });
    }
  },

  reset: () => set(initialState),
}));
```

Also add `useHomeFeedStore.getState().reset()` to `resetStores.ts`.

---

### Task 6: Wire HomeFeed.tsx to real data

**Files:**
- Modify: `src/screens/HomeFeed.tsx`

Replace all mock data and hardcoded strings with data from `useAuthStore` (profile) and `useHomeFeedStore`.

- [ ] **Step 1: Add store imports and useEffect data fetch**

```typescript
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useHomeFeedStore } from '../stores/homeFeedStore';

export default function HomeFeed({ onNavigate }: { onNavigate: (screen: string, params?: any) => void }) {
  const profile = useAuthStore((s) => s.profile);
  const { matches, checkins, isLoading, fetchAll } = useHomeFeedStore();

  useEffect(() => {
    if (profile?.id) fetchAll(profile.id);
  }, [profile?.id]);
  // ... rest of component
```

- [ ] **Step 2: Replace greeting with real profile**

Replace `"Alex Chen"` and hardcoded avatar with:
```typescript
<h1 className="...">{profile?.full_name ?? 'Player'}</h1>
// Avatar:
{profile?.avatar_url
  ? <img src={profile.avatar_url} ... />
  : <div className="w-14 h-14 rounded-full bg-ping/20 flex items-center justify-center">
      <span className="text-ping font-bold text-xl">
        {profile?.full_name?.[0] ?? '?'}
      </span>
    </div>
}
```

- [ ] **Step 3: Replace mock matches with real data**

Replace the hardcoded `<MatchCard>` blocks with a `.map()` over `matches`:

```typescript
{isLoading && <div className="text-center text-gray-400 py-8 text-sm">Loading...</div>}
{!isLoading && matches.length === 0 && (
  <div className="text-center text-gray-400 py-8 text-sm font-medium">
    No upcoming matches yet.
  </div>
)}
{matches.map((match) => (
  <MatchCard
    key={match.id}
    title={match.title}
    time={new Date(match.scheduled_at).toLocaleString('en-US', {
      weekday: 'short', hour: 'numeric', minute: '2-digit',
    })}
    venue={match.venue_name ?? 'TBD'}
    skillLevel={match.skill_level}
    players={match.players.map(p => ({ name: p.full_name, avatar: p.avatar_url ?? '' }))}
    maxPlayers={match.max_players}
    onJoin={() => onNavigate('matchDetail', { id: match.id })}
  />
))}
```

- [ ] **Step 4: Replace mock check-ins with real data**

```typescript
{checkins.map((c) => (
  <CheckInCard
    key={c.id}
    user={{ name: c.user_name, avatar: c.user_avatar ?? '' }}
    venue={c.venue_name}
    time={formatTimeAgo(c.checked_in_at)}
  />
))}
```

Add a `formatTimeAgo` helper at the bottom of the file:
```typescript
function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/stores/homeFeedStore.ts src/stores/resetStores.ts src/lib/queries/feed.ts src/lib/queries/profile.ts src/screens/HomeFeed.tsx
git commit -m "feat: wire HomeFeed to live Supabase data (matches, checkins, activity)"
```

---

## Chunk 2: Phase 3 — Venue Discovery (Google Maps + Supabase)

### Task 7: Install and configure @capacitor/google-maps

**Files:**
- Modify: `package.json`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Modify: `android/variables.gradle` (if it exists, else `android/app/build.gradle`)
- Create: `src/lib/maps.ts`

`@capacitor/google-maps` renders a **native** map layer on Android. It requires a Maps SDK API key.

- [ ] **Step 1: Install the plugin**

```bash
npm install @capacitor/google-maps
npx cap sync android
```

- [ ] **Step 2: Add API key to AndroidManifest.xml**

Inside `<application>`:
```xml
<meta-data
  android:name="com.google.android.geo.API_KEY"
  android:value="YOUR_GOOGLE_MAPS_API_KEY" />
```

Replace `YOUR_GOOGLE_MAPS_API_KEY` with the key from Google Cloud Console (Maps SDK for Android enabled, restricted to your package name: check `android/app/build.gradle` for `applicationId`).

- [ ] **Step 3: Add INTERNET permission if not present**

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

- [ ] **Step 4: Create maps.ts helper**

```typescript
// src/lib/maps.ts
import { GoogleMap } from '@capacitor/google-maps';

let mapInstance: GoogleMap | null = null;

export function getMapInstance(): GoogleMap | null {
  return mapInstance;
}

export async function createMap(
  elementId: string,
  center: { lat: number; lng: number },
  zoom = 13,
): Promise<GoogleMap> {
  if (mapInstance) {
    await mapInstance.destroy();
    mapInstance = null;
  }
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Element #${elementId} not found`);

  mapInstance = await GoogleMap.create({
    id: 'pinglink-map',
    element: el,
    apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    config: {
      center,
      zoom,
    },
  });
  return mapInstance;
}

export async function destroyMap(): Promise<void> {
  if (mapInstance) {
    await mapInstance.destroy();
    mapInstance = null;
  }
}
```

- [ ] **Step 5: Add VITE_GOOGLE_MAPS_API_KEY to .env**

```
VITE_GOOGLE_MAPS_API_KEY=your_web_api_key_here
```

(Web API key for `@capacitor/google-maps` JS layer — separate from the Android manifest key which uses the Android-restricted key.)

---

### Task 8: Create venue Supabase query helpers

**Files:**
- Create: `src/lib/queries/venues.ts`

```typescript
// src/lib/queries/venues.ts
import { supabase } from '../supabase';

export interface Venue {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  venue_type: string | null;
  table_count: number | null;
  is_verified: boolean;
  rating_avg: number | null;
  rating_count: number | null;
  cover_photo_url: string | null;
  distance_m?: number;
}

export interface VenueDetail extends Venue {
  photos: Array<{ id: string; photo_url: string; caption: string | null }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    reviewer_name: string;
    created_at: string;
  }>;
  checkin_count: number;
  is_open_now: boolean | null;
}

/** Fetch venues near a coordinate within radius_km */
export async function fetchNearbyVenues(
  lat: number,
  lng: number,
  radiusKm = 25,
  filters?: { venueType?: string; minRating?: number },
): Promise<Venue[]> {
  // Use PostGIS ST_DWithin via RPC
  const { data, error } = await supabase.rpc('venues_within_radius', {
    user_lat: lat,
    user_lng: lng,
    radius_km: radiusKm,
  });
  if (error || !data) return [];

  let results = data as Venue[];
  if (filters?.venueType) {
    results = results.filter((v) => v.venue_type === filters.venueType);
  }
  if (filters?.minRating) {
    results = results.filter((v) => (v.rating_avg ?? 0) >= (filters.minRating ?? 0));
  }
  return results;
}

/** Fetch full venue detail by ID */
export async function fetchVenueDetail(venueId: string): Promise<VenueDetail | null> {
  const { data, error } = await supabase
    .from('venues')
    .select(`
      *,
      venue_photos(id, photo_url, caption),
      venue_reviews(
        id, rating, comment, created_at,
        reviewer:profiles!venue_reviews_reviewer_id_fkey(full_name)
      ),
      user_venue_checkins(id)
    `)
    .eq('id', venueId)
    .single();

  if (error || !data) return null;

  const row = data as any;
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    venue_type: row.venue_type,
    table_count: row.table_count,
    is_verified: row.is_verified,
    rating_avg: row.rating_avg,
    rating_count: row.rating_count,
    cover_photo_url: row.venue_photos?.[0]?.photo_url ?? null,
    photos: row.venue_photos ?? [],
    reviews: (row.venue_reviews ?? []).map((r: any) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      reviewer_name: r.reviewer?.full_name ?? 'Anonymous',
      created_at: r.created_at,
    })),
    checkin_count: row.user_venue_checkins?.length ?? 0,
    is_open_now: null, // future: parse opening_hours
  };
}

/** Insert a new venue */
export async function insertVenue(
  userId: string,
  payload: {
    name: string;
    address: string;
    city: string;
    latitude: number;
    longitude: number;
    venue_type: string;
    table_count?: number;
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from('venues')
    .insert({ ...payload, added_by: userId })
    .select('id')
    .single();
  if (error) return null;
  return (data as any).id;
}

/** Upload a venue photo to Supabase Storage and insert record */
export async function uploadVenuePhoto(
  venueId: string,
  userId: string,
  file: File,
): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const path = `venues/${venueId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('venue-photos')
    .upload(path, file, { upsert: false });
  if (uploadError) return null;

  const { data: urlData } = supabase.storage.from('venue-photos').getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  const { error: insertError } = await supabase
    .from('venue_photos')
    .insert({ venue_id: venueId, photo_url: publicUrl, uploaded_by: userId });
  if (insertError) return null;

  return publicUrl;
}
```

> **DB prerequisite:** Create a Supabase RPC function `venues_within_radius`. Add this to a new migration file `supabase/migrations/007_rpc_venues_within_radius.sql`:
> ```sql
> CREATE OR REPLACE FUNCTION venues_within_radius(
>   user_lat double precision,
>   user_lng double precision,
>   radius_km double precision DEFAULT 25
> )
> RETURNS TABLE (
>   id uuid, name text, address text, city text,
>   latitude double precision, longitude double precision,
>   venue_type text, table_count int, is_verified boolean,
>   rating_avg numeric, rating_count int, cover_photo_url text,
>   distance_m double precision
> )
> LANGUAGE sql STABLE
> AS $$
>   SELECT
>     v.id, v.name, v.address, v.city,
>     ST_Y(v.location::geometry) AS latitude,
>     ST_X(v.location::geometry) AS longitude,
>     v.venue_type, v.table_count, v.is_verified,
>     v.rating_avg, v.rating_count,
>     (SELECT photo_url FROM venue_photos vp WHERE vp.venue_id = v.id LIMIT 1) AS cover_photo_url,
>     ST_Distance(v.location, ST_MakePoint(user_lng, user_lat)::geography) AS distance_m
>   FROM venues v
>   WHERE ST_DWithin(
>     v.location,
>     ST_MakePoint(user_lng, user_lat)::geography,
>     radius_km * 1000
>   )
>   ORDER BY distance_m ASC;
> $$;
> ```
> Run this in the Supabase SQL editor.

---

### Task 9: Create venueStore.ts

**Files:**
- Create: `src/stores/venueStore.ts`

```typescript
// src/stores/venueStore.ts
import { create } from 'zustand';
import { fetchNearbyVenues, fetchVenueDetail, type Venue, type VenueDetail } from '../lib/queries/venues';

interface VenueFilters {
  venueType?: string;
  minRating?: number;
  radiusKm: number;
}

interface VenueState {
  venues: Venue[];
  selectedVenue: VenueDetail | null;
  filters: VenueFilters;
  isLoading: boolean;
  isLoadingDetail: boolean;
  error: string | null;
  fetchNearby: (lat: number, lng: number, filters?: Partial<VenueFilters>) => Promise<void>;
  fetchDetail: (venueId: string) => Promise<void>;
  setFilters: (filters: Partial<VenueFilters>) => void;
  clearSelectedVenue: () => void;
  reset: () => void;
}

const defaultFilters: VenueFilters = { radiusKm: 25 };

export const useVenueStore = create<VenueState>()((set, get) => ({
  venues: [],
  selectedVenue: null,
  filters: defaultFilters,
  isLoading: false,
  isLoadingDetail: false,
  error: null,

  fetchNearby: async (lat, lng, filters) => {
    const merged = { ...get().filters, ...filters };
    set({ isLoading: true, error: null, filters: merged });
    const results = await fetchNearbyVenues(lat, lng, merged.radiusKm, {
      venueType: merged.venueType,
      minRating: merged.minRating,
    });
    set({ venues: results, isLoading: false });
  },

  fetchDetail: async (venueId) => {
    set({ isLoadingDetail: true, selectedVenue: null });
    const detail = await fetchVenueDetail(venueId);
    set({ selectedVenue: detail, isLoadingDetail: false });
  },

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  clearSelectedVenue: () => set({ selectedVenue: null }),
  reset: () => set({ venues: [], selectedVenue: null, filters: defaultFilters, isLoading: false, error: null }),
}));
```

Add `useVenueStore.getState().reset()` to `resetStores.ts`.

---

### Task 10: Wire MapScreen.tsx to Google Maps + real venues

**Files:**
- Modify: `src/screens/MapScreen.tsx`

The native `@capacitor/google-maps` renders on top of the WebView. The element must be a plain `<div>` with a fixed pixel size. The key pattern:

```typescript
import { useEffect, useRef } from 'react';
import { createMap, destroyMap } from '../lib/maps';
import { useLocationStore } from '../stores/locationStore';
import { useVenueStore } from '../stores/venueStore';

export default function MapScreen({ onNavigate }: { ... }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const { coords } = useLocationStore();
  const { venues, fetchNearby } = useVenueStore();

  useEffect(() => {
    const center = coords
      ? { lat: coords.latitude, lng: coords.longitude }
      : { lat: 47.6062, lng: -122.3321 }; // Seattle fallback

    createMap('map-container', center).then(async (map) => {
      // Add user marker
      await map.addMarker({
        coordinate: center,
        title: 'You',
        iconUrl: '/assets/you-marker.png', // optional custom marker
      });
      // Add venue markers
      for (const v of venues) {
        await map.addMarker({
          coordinate: { lat: v.latitude, lng: v.longitude },
          title: v.name,
        });
      }
    });

    return () => { destroyMap(); };
  }, [coords, venues]);

  useEffect(() => {
    if (coords) fetchNearby(coords.latitude, coords.longitude);
  }, [coords]);

  return (
    <div className="relative w-full h-full bg-[#E8EAED] overflow-hidden">
      {/* Native map renders here — must have explicit pixel dimensions */}
      <div id="map-container" style={{ width: '100%', height: '100%' }} />

      {/* Top search bar (same UI as before) */}
      ...

      {/* Bottom sheet with real venue list */}
      {venues.map((v) => (
        <VenueCard
          key={v.id}
          venue={v}
          onPress={() => onNavigate('venueDetail', { id: v.id })}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 1: Replace mock map background with `<div id="map-container">`**
- [ ] **Step 2: Replace MOCK_VENUES with `venues` from `useVenueStore`**
- [ ] **Step 3: Show distance in metres/km from `v.distance_m`**
- [ ] **Step 4: Commit**

```bash
git add src/screens/MapScreen.tsx src/stores/venueStore.ts src/lib/queries/venues.ts src/lib/maps.ts
git commit -m "feat: real Google Maps + Supabase venue markers in MapScreen"
```

---

### Task 11: Wire VenueDetailScreen.tsx to real data

**Files:**
- Modify: `src/screens/VenueDetailScreen.tsx`
- Modify: `src/screens/MainShell.tsx`

- [ ] **Step 1: Accept `venueId` param from navigation**

Update `VenueDetailScreen` signature:
```typescript
export default function VenueDetailScreen({
  onBack,
  venueId,
}: {
  onBack: () => void;
  venueId: string;
}) {
  const { selectedVenue, isLoadingDetail, fetchDetail } = useVenueStore();
  useEffect(() => { fetchDetail(venueId); }, [venueId]);
  // ...
}
```

- [ ] **Step 2: Update MainShell.tsx to pass screenParams.id**

```typescript
if (activeScreen === 'venueDetail') {
  return <VenueDetailScreen onBack={handleBack} venueId={screenParams?.id} />;
}
```

- [ ] **Step 3: Replace all mock data with `selectedVenue`**

Show `isLoadingDetail` spinner while loading. Map over `selectedVenue.photos` and `selectedVenue.reviews`.

- [ ] **Step 4: Add check-in button**

```typescript
const handleCheckin = async () => {
  if (!session?.user?.id || !venueId) return;
  await supabase.from('user_venue_checkins').insert({
    user_id: session.user.id,
    venue_id: venueId,
    checked_in_at: new Date().toISOString(),
  });
  // Optionally re-fetch detail to update checkin_count
};
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/VenueDetailScreen.tsx src/screens/MainShell.tsx
git commit -m "feat: VenueDetailScreen wired to live Supabase data with check-in"
```

---

### Task 12: Wire VenueFilterScreen.tsx + AddVenueScreen.tsx

**Files:**
- Modify: `src/screens/VenueFilterScreen.tsx`
- Modify: `src/screens/AddVenueScreen.tsx`

**VenueFilterScreen:**
- [ ] Read current `filters` from `useVenueStore`
- [ ] On "Apply", call `setFilters(...)` then trigger `fetchNearby` with updated filters
- [ ] Filter options: venue type (club/community/sports_center/gym/private), min rating (1–5), radius (5/10/25/50 km)

**AddVenueScreen:**
- [ ] Form fields: name, address, city, venue type, table count
- [ ] Use `@capacitor/geolocation` to pre-fill coordinates from current location
- [ ] On submit: call `insertVenue(userId, payload)`
- [ ] Photo upload: `<input type="file" accept="image/*" capture="environment" />` → call `uploadVenuePhoto`
- [ ] On success: `onBack()` and trigger nearby venue refresh

- [ ] **Commit after both:**

```bash
git add src/screens/VenueFilterScreen.tsx src/screens/AddVenueScreen.tsx
git commit -m "feat: VenueFilter applies live filters; AddVenue inserts to Supabase"
```

---

## Chunk 3: Phase 4 — Players + Connections

### Task 13: Create connections query helpers + store

**Files:**
- Create: `src/lib/queries/connections.ts`
- Create: `src/stores/connectionsStore.ts`

- [ ] **Step 1: connections.ts**

```typescript
// src/lib/queries/connections.ts
import { supabase } from '../supabase';

export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface Connection {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  other_profile: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
    skill_level: string | null;
    city: string | null;
  };
}

export async function fetchConnections(userId: string): Promise<Connection[]> {
  const { data, error } = await supabase
    .from('connections')
    .select(`
      id, requester_id, addressee_id, status, created_at,
      requester:profiles!connections_requester_id_fkey(id, full_name, username, avatar_url, skill_level, city),
      addressee:profiles!connections_addressee_id_fkey(id, full_name, username, avatar_url, skill_level, city)
    `)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error || !data) return [];
  return (data as any[]).map((row) => ({
    id: row.id,
    requester_id: row.requester_id,
    addressee_id: row.addressee_id,
    status: row.status,
    created_at: row.created_at,
    other_profile: row.requester_id === userId ? row.addressee : row.requester,
  }));
}

export async function fetchPendingRequests(userId: string) {
  // Incoming: addressee = me, status = pending
  const { data, error } = await supabase
    .from('connections')
    .select(`
      id, requester_id, created_at,
      requester:profiles!connections_requester_id_fkey(id, full_name, username, avatar_url, skill_level, city)
    `)
    .eq('addressee_id', userId)
    .eq('status', 'pending');
  if (error || !data) return [];
  return (data as any[]).map((row) => ({ ...row, other_profile: row.requester }));
}

export async function fetchSentRequests(userId: string) {
  const { data, error } = await supabase
    .from('connections')
    .select(`
      id, addressee_id, created_at,
      addressee:profiles!connections_addressee_id_fkey(id, full_name, username, avatar_url, skill_level, city)
    `)
    .eq('requester_id', userId)
    .eq('status', 'pending');
  if (error || !data) return [];
  return (data as any[]).map((row) => ({ ...row, other_profile: row.addressee }));
}

export async function sendConnectionRequest(requesterId: string, addresseeId: string) {
  const { error } = await supabase
    .from('connections')
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' });
  return !error;
}

export async function respondToRequest(connectionId: string, accept: boolean) {
  const { error } = await supabase
    .from('connections')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', connectionId);
  return !error;
}
```

- [ ] **Step 2: connectionsStore.ts**

```typescript
// src/stores/connectionsStore.ts
import { create } from 'zustand';
import {
  fetchConnections, fetchPendingRequests, fetchSentRequests,
  sendConnectionRequest, respondToRequest, type Connection,
} from '../lib/queries/connections';

interface ConnectionsState {
  accepted: Connection[];
  pending: any[];
  sent: any[];
  isLoading: boolean;
  fetchAll: (userId: string) => Promise<void>;
  send: (requesterId: string, addresseeId: string) => Promise<boolean>;
  respond: (connectionId: string, accept: boolean) => Promise<boolean>;
  reset: () => void;
}

export const useConnectionsStore = create<ConnectionsState>()((set) => ({
  accepted: [],
  pending: [],
  sent: [],
  isLoading: false,

  fetchAll: async (userId) => {
    set({ isLoading: true });
    const [accepted, pending, sent] = await Promise.all([
      fetchConnections(userId),
      fetchPendingRequests(userId),
      fetchSentRequests(userId),
    ]);
    set({ accepted, pending, sent, isLoading: false });
  },

  send: async (requesterId, addresseeId) => {
    const ok = await sendConnectionRequest(requesterId, addresseeId);
    return ok;
  },

  respond: async (connectionId, accept) => {
    const ok = await respondToRequest(connectionId, accept);
    return ok;
  },

  reset: () => set({ accepted: [], pending: [], sent: [], isLoading: false }),
}));
```

Add reset to `resetStores.ts`.

---

### Task 14: Create player search query helper + wire PlayerSearchScreen

**Files:**
- Create: `src/lib/queries/players.ts`
- Modify: `src/screens/PlayerSearchScreen.tsx`

- [ ] **Step 1: players.ts**

```typescript
// src/lib/queries/players.ts
import { supabase } from '../supabase';

export interface PlayerCard {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  skill_level: string | null;
  playing_styles: string[];
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_m?: number;
  connection_status?: 'none' | 'pending' | 'accepted' | 'sent';
}

export async function searchPlayers(
  userId: string,
  opts: {
    lat?: number;
    lng?: number;
    radiusKm?: number;
    skillLevel?: string;
    query?: string;
    limit?: number;
  },
): Promise<PlayerCard[]> {
  let qb = supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, skill_level, playing_styles, city, latitude, longitude')
    .neq('id', userId)
    .eq('setup_complete', true)
    .eq('profile_visibility', 'public');

  if (opts.skillLevel && opts.skillLevel !== 'Nearby') {
    qb = qb.eq('skill_level', opts.skillLevel.toLowerCase());
  }
  if (opts.query) {
    qb = qb.ilike('full_name', `%${opts.query}%`);
  }

  const { data, error } = await qb.limit(opts.limit ?? 50);
  if (error || !data) return [];

  let players = data as PlayerCard[];

  // Client-side proximity filter (PostGIS RPC preferred for production)
  if (opts.lat && opts.lng && opts.radiusKm) {
    players = players
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => {
        const dLat = ((p.latitude! - opts.lat!) * Math.PI) / 180;
        const dLng = ((p.longitude! - opts.lng!) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((opts.lat! * Math.PI) / 180) *
            Math.cos((p.latitude! * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const distance_m = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { ...p, distance_m };
      })
      .filter((p) => p.distance_m! <= (opts.radiusKm! * 1000));
  }

  return players.sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity));
}
```

- [ ] **Step 2: Update PlayerSearchScreen.tsx**

```typescript
import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useLocationStore } from '../stores/locationStore';
import { useConnectionsStore } from '../stores/connectionsStore';
import { searchPlayers, type PlayerCard } from '../lib/queries/players';

export default function PlayerSearchScreen({ onNavigate }: ...) {
  const { profile } = useAuthStore();
  const { coords } = useLocationStore();
  const { send } = useConnectionsStore();
  const [players, setPlayers] = useState<PlayerCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Nearby');
  const [distance, setDistance] = useState('10km');

  const load = async () => {
    if (!profile?.id) return;
    setIsLoading(true);
    const km = parseInt(distance);
    const results = await searchPlayers(profile.id, {
      lat: coords?.latitude,
      lng: coords?.longitude,
      radiusKm: isNaN(km) ? 10 : km,
      skillLevel: activeFilter !== 'Nearby' ? activeFilter : undefined,
      query: searchQuery || undefined,
    });
    setPlayers(results);
    setIsLoading(false);
  };

  useEffect(() => { load(); }, [activeFilter, distance, profile?.id]);
  // ... render players from state
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries/players.ts src/lib/queries/connections.ts src/stores/connectionsStore.ts src/screens/PlayerSearchScreen.tsx
git commit -m "feat: PlayerSearch wired to Supabase with proximity + skill filter"
```

---

### Task 15: Wire PlayerProfileScreen.tsx + add connection actions

**Files:**
- Modify: `src/screens/PlayerProfileScreen.tsx`
- Modify: `src/screens/MainShell.tsx`

- [ ] **Step 1: Accept `playerId` param**

```typescript
export default function PlayerProfileScreen({
  onBack,
  playerId,
}: {
  onBack: () => void;
  playerId: string;
}) {
  const { profile: myProfile } = useAuthStore();
  const { send, accepted } = useConnectionsStore();
  const [playerProfile, setPlayerProfile] = useState<Profile | null>(null);
  const [availability, setAvailability] = useState<any[]>([]);

  useEffect(() => {
    fetchProfileById(playerId).then(setPlayerProfile);
    supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', playerId)
      .then(({ data }) => setAvailability(data ?? []));
  }, [playerId]);
```

- [ ] **Step 2: Connection status button**

```typescript
const connectionStatus = (() => {
  const conn = accepted.find(
    (c) => c.other_profile.id === playerId,
  );
  if (conn) return 'connected';
  // check pending/sent...
  return 'none';
})();

// Render:
{connectionStatus === 'none' && (
  <button onClick={() => send(myProfile!.id, playerId)}>
    Connect
  </button>
)}
{connectionStatus === 'connected' && (
  <span>Connected</span>
)}
```

- [ ] **Step 3: Update MainShell to pass playerId**

```typescript
if (activeScreen === 'playerProfile') {
  return <PlayerProfileScreen onBack={handleBack} playerId={screenParams?.id} />;
}
```

- [ ] **Step 4: Commit**

---

### Task 16: Wire ConnectionsListScreen.tsx + Notifications

**Files:**
- Modify: `src/screens/ConnectionsListScreen.tsx`
- Create: `src/screens/NotificationsScreen.tsx`
- Modify: `src/App.tsx`
- Create: `src/lib/queries/notifications.ts`

**ConnectionsListScreen:**
- [ ] On mount: `fetchAll(userId)` from `useConnectionsStore`
- [ ] Connections tab: render `accepted` list
- [ ] Requests tab: render `pending` list with Accept/Decline buttons calling `respond(id, true/false)`
- [ ] Sent tab: render `sent` list

**NotificationsScreen:**
```typescript
// src/screens/NotificationsScreen.tsx
// Fetch from notifications table
// notification_type: connection_request | match_invite | checkin | message | venue_review
// Mark as read: update notifications.read_at = now()
```

- [ ] **Step 2: Add NotificationsScreen to App.tsx routing**

```typescript
// In App.tsx, in the screen router:
if (screen === 'notifications') return <NotificationsScreen onBack={() => navigate('home')} />;
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/ConnectionsListScreen.tsx src/screens/NotificationsScreen.tsx src/App.tsx src/lib/queries/notifications.ts
git commit -m "feat: ConnectionsList, notifications wired to Supabase"
```

---

## Chunk 4: Phase 5 — Real-Time Messaging

### Task 17: Create messaging query helpers + store

**Files:**
- Create: `src/lib/queries/messages.ts`
- Create: `src/stores/messagesStore.ts`

```typescript
// src/lib/queries/messages.ts
import { supabase } from '../supabase';

export interface Conversation {
  id: string;
  other_user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    is_online: boolean;
  };
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  sent_at: string;
  read_at: string | null;
}

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id, last_message, last_message_at,
      participants:conversation_participants(
        user:profiles(id, full_name, avatar_url, is_online)
      ),
      messages(id, read_at, sender_id)
    `)
    .order('last_message_at', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map((conv) => {
    const other = conv.participants
      ?.find((p: any) => p.user?.id !== userId)?.user;
    const unread = conv.messages?.filter(
      (m: any) => m.sender_id !== userId && !m.read_at,
    ).length ?? 0;
    return {
      id: conv.id,
      other_user: other ?? { id: '', full_name: 'Unknown', avatar_url: null, is_online: false },
      last_message: conv.last_message,
      last_message_at: conv.last_message_at,
      unread_count: unread,
    };
  });
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true });
  if (error || !data) return [];
  return data as Message[];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content, sent_at: new Date().toISOString() })
    .select()
    .single();
  if (error) return null;
  return data as Message;
}

export async function getOrCreateConversation(
  userAId: string,
  userBId: string,
): Promise<string | null> {
  // Check existing via RPC or manual lookup
  const { data } = await supabase.rpc('get_or_create_conversation', {
    user_a: userAId,
    user_b: userBId,
  });
  return data ?? null;
}
```

> **DB prerequisite:** Add `get_or_create_conversation` RPC to Supabase:
> ```sql
> CREATE OR REPLACE FUNCTION get_or_create_conversation(user_a uuid, user_b uuid)
> RETURNS uuid LANGUAGE plpgsql AS $$
> DECLARE
>   conv_id uuid;
> BEGIN
>   SELECT c.id INTO conv_id
>   FROM conversations c
>   JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = user_a
>   JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = user_b
>   LIMIT 1;
>   IF conv_id IS NULL THEN
>     INSERT INTO conversations DEFAULT VALUES RETURNING id INTO conv_id;
>     INSERT INTO conversation_participants(conversation_id, user_id) VALUES (conv_id, user_a), (conv_id, user_b);
>   END IF;
>   RETURN conv_id;
> END;
> $$;
> ```

- [ ] **messagesStore.ts with Realtime:**

```typescript
// src/stores/messagesStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import {
  fetchConversations, fetchMessages, sendMessage,
  getOrCreateConversation, type Conversation, type Message,
} from '../lib/queries/messages';

interface MessagesState {
  conversations: Conversation[];
  activeConvId: string | null;
  messages: Message[];
  isLoadingConvs: boolean;
  isLoadingMsgs: boolean;
  fetchConversations: (userId: string) => Promise<void>;
  openConversation: (convId: string) => Promise<void>;
  startConversation: (myId: string, otherId: string) => Promise<string | null>;
  send: (senderId: string, content: string) => Promise<void>;
  closeConversation: () => void;
  reset: () => void;
}

let realtimeSub: ReturnType<typeof supabase.channel> | null = null;

export const useMessagesStore = create<MessagesState>()((set, get) => ({
  conversations: [],
  activeConvId: null,
  messages: [],
  isLoadingConvs: false,
  isLoadingMsgs: false,

  fetchConversations: async (userId) => {
    set({ isLoadingConvs: true });
    const convs = await fetchConversations(userId);
    set({ conversations: convs, isLoadingConvs: false });
  },

  openConversation: async (convId) => {
    set({ isLoadingMsgs: true, activeConvId: convId, messages: [] });
    const msgs = await fetchMessages(convId);
    set({ messages: msgs, isLoadingMsgs: false });

    // Subscribe to new messages via Realtime
    if (realtimeSub) supabase.removeChannel(realtimeSub);
    realtimeSub = supabase
      .channel(`messages:${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => {
        set((s) => ({ messages: [...s.messages, payload.new as Message] }));
      })
      .subscribe();
  },

  startConversation: async (myId, otherId) => {
    const convId = await getOrCreateConversation(myId, otherId);
    return convId;
  },

  send: async (senderId, content) => {
    const { activeConvId } = get();
    if (!activeConvId) return;
    await sendMessage(activeConvId, senderId, content);
    // Realtime subscription will push the new message into state
  },

  closeConversation: () => {
    if (realtimeSub) { supabase.removeChannel(realtimeSub); realtimeSub = null; }
    set({ activeConvId: null, messages: [] });
  },

  reset: () => {
    if (realtimeSub) { supabase.removeChannel(realtimeSub); realtimeSub = null; }
    set({ conversations: [], activeConvId: null, messages: [], isLoadingConvs: false, isLoadingMsgs: false });
  },
}));
```

Add reset to `resetStores.ts`.

---

### Task 18: Build MessagesScreen (Inbox)

**Files:**
- Modify: `src/screens/MainShell.tsx` (replace `MessagesScreen` placeholder)
- Create: `src/screens/MessagesScreen.tsx`
- Create: `src/screens/ChatScreen.tsx`

**MessagesScreen.tsx:**
- [ ] On mount: `fetchConversations(userId)`
- [ ] Show list of `conversations` with avatar, name, last message preview, unread badge, time
- [ ] Tapping a conversation: `openConversation(conv.id)` then navigate to ChatScreen

```typescript
// Navigation from MessagesScreen:
onNavigate('chat', { convId: conv.id, otherUser: conv.other_user })
```

Add `'chat'` to the overlay screen list in `MainShell.handleNavigate`.

---

### Task 19: Build ChatScreen

**Files:**
- Create: `src/screens/ChatScreen.tsx`
- Modify: `src/screens/MainShell.tsx`

```typescript
// src/screens/ChatScreen.tsx
export default function ChatScreen({
  onBack,
  convId,
  otherUser,
}: {
  onBack: () => void;
  convId: string;
  otherUser: { id: string; full_name: string; avatar_url: string | null };
}) {
  const { profile } = useAuthStore();
  const { messages, send, openConversation, closeConversation } = useMessagesStore();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    openConversation(convId);
    return () => closeConversation();
  }, [convId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim() || !profile?.id) return;
    await send(profile.id, draft.trim());
    setDraft('');
  };

  // Render message bubbles grouped by sender
  // Mine: right-aligned, bg-black text-white
  // Theirs: left-aligned, bg-white border border-gray-100
}
```

Add to MainShell:
```typescript
if (activeScreen === 'chat') {
  return <ChatScreen onBack={handleBack} convId={screenParams?.convId} otherUser={screenParams?.otherUser} />;
}
```

- [ ] **Commit after Tasks 17-19:**

```bash
git add src/stores/messagesStore.ts src/lib/queries/messages.ts src/screens/MessagesScreen.tsx src/screens/ChatScreen.tsx src/screens/MainShell.tsx
git commit -m "feat: real-time messaging with Supabase Realtime (inbox + chat)"
```

---

## Chunk 5: Phase 6 — Match Scheduling

### Task 20: Create matches query helpers + store

**Files:**
- Create: `src/lib/queries/matches.ts`
- Create: `src/stores/matchesStore.ts`

```typescript
// src/lib/queries/matches.ts
import { supabase } from '../supabase';

export interface Match {
  id: string;
  title: string;
  match_type: 'singles' | 'doubles' | 'multi';
  skill_level: string;
  scheduled_at: string;
  venue_id: string | null;
  venue_name: string | null;
  max_players: number;
  status: 'open' | 'full' | 'completed' | 'cancelled';
  created_by: string;
  players: Array<{ id: string; full_name: string; avatar_url: string | null; role: string }>;
}

export async function fetchMyMatches(userId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      id, title, match_type, skill_level, scheduled_at, max_players, status, created_by,
      venue:venues(id, name),
      match_players!inner(
        role,
        player:profiles!match_players_player_id_fkey(id, full_name, avatar_url)
      )
    `)
    .eq('match_players.player_id', userId)
    .order('scheduled_at', { ascending: true });

  if (error || !data) return [];
  return (data as any[]).map(mapMatch);
}

export async function fetchMatchById(id: string): Promise<Match | null> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      id, title, match_type, skill_level, scheduled_at, max_players, status, created_by,
      venue:venues(id, name),
      match_players(
        role,
        player:profiles!match_players_player_id_fkey(id, full_name, avatar_url)
      )
    `)
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return mapMatch(data as any);
}

function mapMatch(row: any): Match {
  return {
    id: row.id,
    title: row.title,
    match_type: row.match_type,
    skill_level: row.skill_level,
    scheduled_at: row.scheduled_at,
    venue_id: row.venue?.id ?? null,
    venue_name: row.venue?.name ?? null,
    max_players: row.max_players,
    status: row.status,
    created_by: row.created_by,
    players: (row.match_players ?? []).map((mp: any) => ({
      id: mp.player?.id, full_name: mp.player?.full_name, avatar_url: mp.player?.avatar_url, role: mp.role,
    })),
  };
}

export async function createMatch(payload: {
  title: string;
  match_type: string;
  skill_level: string;
  scheduled_at: string;
  venue_id: string | null;
  max_players: number;
  created_by: string;
}): Promise<string | null> {
  const { data, error } = await supabase.from('matches').insert(payload).select('id').single();
  if (error) return null;
  const matchId = (data as any).id;
  // Auto-add creator as player
  await supabase.from('match_players').insert({
    match_id: matchId,
    player_id: payload.created_by,
    role: 'organizer',
  });
  return matchId;
}

export async function joinMatch(matchId: string, playerId: string): Promise<boolean> {
  const { error } = await supabase.from('match_players').insert({
    match_id: matchId,
    player_id: playerId,
    role: 'player',
  });
  return !error;
}
```

---

### Task 21: Build MatchSchedulingScreen

**Files:**
- Create: `src/screens/MatchSchedulingScreen.tsx`
- Modify: `src/screens/MainShell.tsx`

- [ ] Form: title, match type (singles/doubles/multi), skill level, date + time picker, max players, venue (optional, searchable)
- [ ] Date/time: use `<input type="datetime-local" />` — Capacitor handles native picker on Android
- [ ] On submit: `createMatch(payload)` → navigate to `matchDetail` with new ID
- [ ] Add `'matchScheduling'` to MainShell overlay routing

---

### Task 22: Build MatchDetailScreen

**Files:**
- Create: `src/screens/MatchDetailScreen.tsx`
- Modify: `src/screens/MainShell.tsx`

- [ ] Fetch match by ID via `fetchMatchById`
- [ ] Show all players with avatars
- [ ] Join button (if status === 'open' and user not already a player)
- [ ] Message organizer button → `getOrCreateConversation` → navigate to chat
- [ ] Show venue on map (link to VenueDetail)
- [ ] Creator can cancel match: `update matches set status = 'cancelled'`

Add to MainShell:
```typescript
if (activeScreen === 'matchScheduling') {
  return <MatchSchedulingScreen onBack={handleBack} onCreated={(id) => handleNavigate('matchDetail', { id })} />;
}
if (activeScreen === 'matchDetail') {
  return <MatchDetailScreen onBack={handleBack} matchId={screenParams?.id} />;
}
```

Also add "Schedule Match" quick-action button on HomeFeed and PlayerProfile → `onNavigate('matchScheduling')`.

- [ ] **Commit after Phase 6:**

```bash
git add src/lib/queries/matches.ts src/stores/matchesStore.ts src/screens/MatchSchedulingScreen.tsx src/screens/MatchDetailScreen.tsx src/screens/MainShell.tsx
git commit -m "feat: match scheduling and detail screens wired to Supabase"
```

---

## Chunk 6: Phase 7 — My Profile + Edit + Settings

### Task 23: Build MyProfileScreen

**Files:**
- Modify: `src/screens/MainShell.tsx` (replace `ProfileScreen` placeholder import)
- Create: `src/screens/MyProfileScreen.tsx`

```typescript
// src/screens/MyProfileScreen.tsx
// Data sources:
// - profile: from useAuthStore
// - user_availability: supabase.from('user_availability').select('*').eq('user_id', userId)
// - user_preferred_venues: join with venues table
// - matches: fetchMyMatches(userId)
// - connections count: useConnectionsStore.accepted.length

// Layout:
// - Cover photo + avatar (with edit button overlay)
// - Name, username, city, skill badge
// - Stats row: connections | matches played | venues visited
// - Playing styles + grips tags
// - Availability chips (Mon/Eve etc.)
// - Preferred venues list
// - Recent activity feed (last 5)
// - Edit Profile button → onNavigate('editProfile')
// - Settings button (top right) → onNavigate('settings')
```

Replace the `ProfileScreen` placeholder in MainShell:
```typescript
import MyProfileScreen from './MyProfileScreen';
// In render:
<div className={`... ${activeTab === 'profile' ? 'block' : 'hidden'}`}>
  <MyProfileScreen onNavigate={handleNavigate} />
</div>
```

---

### Task 24: Build EditProfileScreen

**Files:**
- Create: `src/screens/EditProfileScreen.tsx`
- Create: `src/lib/queries/profile.ts` (extend with updateProfile)
- Modify: `src/screens/MainShell.tsx`

```typescript
// Sections:
// 1. Avatar + Cover photo upload (Supabase Storage: avatars/ bucket)
// 2. Basic info: full_name, username, bio, city, date_of_birth
// 3. Skill & Style: skill_level dropdown, playing_styles multi-select, grips multi-select, techniques multi-select
// 4. Availability: user_availability rows (day_of_week + time_of_day checkboxes)
// 5. Preferred venues: user_preferred_venues (search + add)
// 6. Privacy: profile_visibility toggle, show_location toggle, show_online_status toggle

// On save: single supabase.from('profiles').update(...).eq('id', userId)
//           + delete/insert user_availability rows
//           + refreshProfile() from authStore
```

**Photo upload pattern (same as AddVenue):**
```typescript
const handleAvatarUpload = async (file: File) => {
  const path = `avatars/${userId}/${Date.now()}.${file.name.split('.').pop()}`;
  await supabase.storage.from('avatars').upload(path, file, { upsert: true });
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId);
  await useAuthStore.getState().refreshProfile();
};
```

Add to MainShell overlay routing:
```typescript
if (activeScreen === 'editProfile') {
  return <EditProfileScreen onBack={handleBack} />;
}
```

---

### Task 25: Build SettingsScreen

**Files:**
- Create: `src/screens/SettingsScreen.tsx`

```typescript
// Sections:
// Account
//   - Change email (supabase.auth.updateUser({ email }))
//   - Change password (supabase.auth.updateUser({ password }))
//   - Delete account (confirm dialog → supabase.rpc('delete_my_account') + logout)
//
// Privacy
//   - Profile visibility (public / connections_only) → profiles.profile_visibility
//   - Show location → profiles.show_location
//   - Show online status → profiles.show_online_status
//
// Notifications (future — placeholder toggles)
//
// About
//   - App version, Terms of Service, Privacy Policy links
//
// Logout button → useAuthStore.getState().logout()
```

Add to MainShell overlay routing:
```typescript
if (activeScreen === 'settings') {
  return <SettingsScreen onBack={handleBack} />;
}
```

- [ ] **Commit after Phase 7:**

```bash
git add src/screens/MyProfileScreen.tsx src/screens/EditProfileScreen.tsx src/screens/SettingsScreen.tsx src/screens/MainShell.tsx src/lib/queries/profile.ts
git commit -m "feat: MyProfile, EditProfile, Settings screens wired to Supabase"
```

---

## App.tsx Screen Routing Summary (after all phases)

The following top-level screens must be registered in `App.tsx`'s screen router:

| Screen key | Component | Condition |
|---|---|---|
| `splash` | `SplashScreen` | boot |
| `loading` | `LoadingScreen` | isLoading |
| `onboarding` | `OnboardingScreen` | first install |
| `auth` | `Login/Register/ForgotPassword` | unauthenticated |
| `profile-setup` | `ProfileSetup` | !setup_complete |
| `home` | `MainShell` | authenticated |
| `notifications` | `NotificationsScreen` | from any tab |

**MainShell overlay screens** (handled inside MainShell, not App.tsx):

`venueFilter`, `venueDetail`, `addVenue`, `playerProfile`, `connectionsList`, `chat`, `matchScheduling`, `matchDetail`, `editProfile`, `settings`

---

## Environment Variables Summary

All these must be in `.env` (and handled via `import.meta.env`):

```
VITE_SUPABASE_URL=https://lqzcyrbducujypzpicfq.supabase.co
VITE_SUPABASE_ANON_KEY=<your_anon_key>
VITE_GOOGLE_MAPS_API_KEY=<web_api_key>
```

Android manifest uses the **Android-restricted** Google Maps API key (not the `.env` web key).

---

## File Structure After All Phases

```
src/
  lib/
    supabase.ts             (Phase 1 — existing)
    types.ts                (Phase 1 — existing)
    maps.ts                 (Phase 3)
    queries/
      feed.ts               (Phase 2)
      profile.ts            (Phase 2, extended Phase 7)
      venues.ts             (Phase 3)
      connections.ts        (Phase 4)
      players.ts            (Phase 4)
      notifications.ts      (Phase 4)
      messages.ts           (Phase 5)
      matches.ts            (Phase 6)
  stores/
    authStore.ts            (Phase 1 — existing)
    resetStores.ts          (Phase 1 — extended each phase)
    locationStore.ts        (Phase 2)
    homeFeedStore.ts        (Phase 2)
    venueStore.ts           (Phase 3)
    connectionsStore.ts     (Phase 4)
    messagesStore.ts        (Phase 5)
    matchesStore.ts         (Phase 6)
  screens/
    SplashScreen.tsx        (Phase 1 — existing)
    LoadingScreen.tsx       (Phase 1 — existing)
    OnboardingScreen.tsx    (Phase 1 — existing)
    Login.tsx               (Phase 1 — existing)
    Register.tsx            (Phase 1 — existing)
    ForgotPassword.tsx      (Phase 1 — existing)
    ProfileSetup.tsx        (Phase 1 — existing)
    MainShell.tsx           (Phase 1 — extended each phase)
    HomeFeed.tsx            (Phase 2 — wired)
    MapScreen.tsx           (Phase 3 — wired)
    VenueFilterScreen.tsx   (Phase 3 — wired)
    VenueDetailScreen.tsx   (Phase 3 — wired)
    AddVenueScreen.tsx      (Phase 3 — wired)
    PlayerSearchScreen.tsx  (Phase 4 — wired)
    PlayerProfileScreen.tsx (Phase 4 — wired)
    ConnectionsListScreen.tsx (Phase 4 — wired)
    NotificationsScreen.tsx (Phase 4 — new)
    MessagesScreen.tsx      (Phase 5 — new)
    ChatScreen.tsx          (Phase 5 — new)
    MatchSchedulingScreen.tsx (Phase 6 — new)
    MatchDetailScreen.tsx   (Phase 6 — new)
    MyProfileScreen.tsx     (Phase 7 — new)
    EditProfileScreen.tsx   (Phase 7 — new)
    SettingsScreen.tsx      (Phase 7 — new)
  components/
    AuthProvider.tsx        (Phase 1 — extended Phase 2)
  App.tsx                   (Phase 1 — extended Phase 4)
supabase/
  migrations/
    001–006_*.sql           (Phase 1 — existing)
    007_rpc_venues_within_radius.sql  (Phase 3)
    008_rpc_get_or_create_conversation.sql (Phase 5)
```

---

## Phase Order Summary

| Phase | Focus | New packages | Key deliverable |
|---|---|---|---|
| 2 | Location + Live HomeFeed | `@capacitor/geolocation` | Location persisted to DB; HomeFeed shows real matches + checkins |
| 3 | Venue Discovery | `@capacitor/google-maps` | Real map with venue pins; detail/add/filter all live |
| 4 | Players + Connections + Notifications | — | Find/connect to real players; notifications screen |
| 5 | Real-time Messaging | — | Inbox + chat with Supabase Realtime |
| 6 | Match Scheduling | — | Create/join/view matches end-to-end |
| 7 | Profile + Settings | — | Full profile editing, photo upload, privacy controls |
