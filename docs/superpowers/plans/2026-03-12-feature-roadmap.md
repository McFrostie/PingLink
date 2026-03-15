# PingLink Feature Roadmap — Phase 8+

**Created:** 2026-03-12  
**Status:** In Progress  
**Scope:** All incomplete, missing, and buggy features identified in the post-Phase-7 audit.

---

## Overview

The audit identified 2 critical bugs, 2 minor bugs, 4 partially-complete features, and 8 unbuilt features. This document organizes all of them into sequenced phases, prioritised by safety (bug fixes first), then UX completeness, then performance, then polish.

---

## Phase 1 — Critical Bug Fixes

> These bugs cause silent failures or incorrect behaviour for real users right now. Fix before any new features.

### Task 1.1 — Fix notification type enum mismatch

**Files:** `src/lib/queries/notifications.ts`, `src/screens/Notifications.tsx`

**Problem:**  
The frontend `Notification.notification_type` TypeScript union uses wrong string literals that do not match the values the DB trigger inserts. This means every notification card falls through to the default case and renders generic UI.

**DB enum values (correct):**
```
connection_request, connection_accepted, match_request, match_confirmed,
match_cancelled, message, venue_approved, achievement_earned, check_in
```

**Frontend values (wrong, to replace):**
```
match_invite → should be match_request
checkin      → should be check_in
venue_review → should be venue_approved
(missing)    → connection_accepted, match_confirmed, match_cancelled, achievement_earned
```

**Steps:**
1. In `src/lib/queries/notifications.ts`:
   - Update `Notification.notification_type` union type to the 9 correct DB values.
2. In `src/screens/Notifications.tsx` — `getNotificationConfig()` switch statement:
   - Rename case `'match_invite'` → `'match_request'`
   - Rename case `'checkin'` → `'check_in'`
   - Rename case `'venue_review'` → `'venue_approved'`
   - Add case `'connection_accepted'`: icon 🤝, label "accepted your connection request"
   - Add case `'match_confirmed'`: icon 🏓, label "confirmed your match"
   - Add case `'match_cancelled'`: icon ❌, label "cancelled the match"
   - Add case `'achievement_earned'`: icon 🏆, label "You earned an achievement"

**Acceptance criteria:** Every notification type from the DB renders the correct icon and text. No notification falls through to the generic default.

---

### Task 1.2 — Fix connectionsStore.respond re-fetch bug

**File:** `src/stores/connectionsStore.ts`

**Problem:**  
After calling `supabase.rpc('respond_to_connection')`, the store calls `fetchAll(get().pending[0]?.addressee_id)`. This is wrong on two counts:
1. The `pending` array items expose `other_profile.id`, not a raw `addressee_id` field, so the lookup returns `undefined`.
2. `fetchAll(undefined)` silently skips the refresh, leaving stale data in the UI.

**Steps:**
1. Import `useAuthStore` inside the store (dynamic import to avoid circular dependency — use `(await import('./authStore')).useAuthStore.getState()`), OR pass `userId` as a parameter to `respond()`.
2. Retrieve `userId` from `useAuthStore.getState().session?.user?.id`.
3. Replace `fetchAll(get().pending[0]?.addressee_id)` with `fetchAll(userId)`.
4. While here: type `pending` and `sent` arrays properly (replace `any[]` with `Connection[]`).

**Acceptance criteria:** Accepting or declining a connection request immediately refreshes the requests list without requiring the user to leave and re-enter the screen.

---

### Task 1.3 — Fix migration 009 double-trigger risk

**File:** `supabase/migrations/009_conversations_sender_id.sql`

**Problem:**  
Migration 009 adds a new `cache_last_message` trigger that does the same job as the `messages_update_conversation` trigger created in migration 006. On a fresh DB both triggers fire on every message INSERT, causing a double-write of `last_message_at` and `last_message_preview`.

**Steps:**
1. Open `supabase/migrations/009_conversations_sender_id.sql`.
2. Add at the top (before the new trigger definition):
   ```sql
   DROP TRIGGER IF EXISTS messages_update_conversation ON messages;
   ```
3. Verify the new `cache_last_message` trigger covers all the columns the old one wrote (`last_message_at`, `last_message_preview`, `last_message_sender_id`).

**Acceptance criteria:** Only one trigger fires on message INSERT. The conversation `last_message_sender_id` column is populated correctly.

---

## Phase 2 — Core UX Completions

> Features that are partially built or have obvious visible gaps. These are things users will notice immediately.

### Task 2.1 — Write a Review (Venue Detail)

**Files:** `src/lib/queries/venues.ts`, `src/stores/venueStore.ts`, `src/screens/VenueDetailScreen.tsx`

**Problem:** VenueDetailScreen shows the review list but has no way to submit a new review.

**Steps:**
1. **`src/lib/queries/venues.ts`** — Add `submitReview(venueId, userId, rating, body)`:
   ```ts
   export async function submitReview(venueId: string, userId: string, rating: number, body: string) {
     return supabase.from('venue_reviews').insert({ venue_id: venueId, reviewer_id: userId, rating, body });
   }
   ```
2. **`src/stores/venueStore.ts`** — Add `submitReview(venueId, rating, body)` action:
   - Get `userId` from `useAuthStore.getState().profile?.id`
   - Call `submitReview(venueId, userId, rating, body)` from queries
   - On success: re-fetch the venue detail (refresh reviews list)
3. **`src/screens/VenueDetailScreen.tsx`** — Add review form UI in the Reviews section:
   - Only show if the user is logged in and has not already reviewed this venue
   - 5-star tap-to-rate row (use existing star icon)
   - Optional `<textarea>` for written comment (max 500 chars)
   - Submit button that calls `venueStore.submitReview`
   - Show loading state; show success toast; hide form after submit

**Acceptance criteria:** A user can submit a star rating (with optional comment) from VenueDetailScreen. After submit, their review appears in the list without a page reload.

---

### Task 2.2 — Dynamic nav badge counts

**Files:** `src/screens/MainShell.tsx`, `src/stores/messagesStore.ts`, add lightweight unread notification count

**Problem:** The bottom nav `hasBadge` prop is hardcoded `true` on Home tab (notifications bell) and Messages tab. Users always see a red dot even when there is nothing new.

**Steps:**

**Messages tab badge:**
1. In `messagesStore`, add a derived selector `unreadCount`:
   - Loop `state.conversations`, for each conversation determine if the current user is `participant_1_id` or `participant_2_id`
   - Sum either `unread_count_p1` or `unread_count_p2` accordingly
   - Expose as `unreadMessagesCount: number`
2. In `MainShell.tsx`, read `unreadMessagesCount` from `useMessagesStore`
3. Pass `hasBadge={unreadMessagesCount > 0}` to the Messages nav item

**Home/Notifications bell badge:**
1. Add `unreadNotifCount: number` and `fetchUnreadCount()` to a small extension of an existing store (or add to `homeFeedStore`)
2. Query: `supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false)`
3. Call `fetchUnreadCount()` on mount and whenever the Notifications overlay is closed
4. Pass `hasBadge={unreadNotifCount > 0}` to the Home nav item

**Acceptance criteria:** The red badge only shows on the Messages tab when there are real unread messages. The badge disappears after reading. Home bell badge follows the same logic for unread notifications.

---

### Task 2.3 — Notifications deep-link routing

**Files:** `src/App.tsx`, `src/screens/Notifications.tsx`

**Problem:** Tapping a notification card does nothing. Users cannot navigate from a notification to the related match, player, or venue.

**Steps:**
1. **`src/App.tsx`** — Define `handleNotifNavigate(type, refId)`:
   - `connection_request` / `connection_accepted` → set `activeScreen = 'playerProfile'`, `screenParams = { userId: refId }`
   - `match_request` / `match_confirmed` / `match_cancelled` → `activeScreen = 'matchDetail'`, `screenParams = { matchId: refId }`
   - `venue_approved` → `activeScreen = 'venueDetail'`, `screenParams = { venueId: refId }`
   - `achievement_earned` → navigate to `MyProfile` tab (no overlay needed)
   - `message` → `activeScreen = 'chat'`, `screenParams = { conversationId: refId }`
2. Pass `onNavigate={handleNotifNavigate}` as prop to the `<Notifications>` overlay component.
3. **`src/screens/Notifications.tsx`** — Add `onNavigate` prop; in `NotificationCard` onClick handler call `onNavigate(notif.notification_type, notif.reference_id)` then close the notifications overlay.

**Acceptance criteria:** Tapping any notification closes the overlay and navigates to the relevant screen showing the correct entity.

---

## Phase 3 — Discovery & Search Enhancements ✅ COMPLETE

> These fix correctness or scalability issues in search features that currently work but have hidden limitations.

### Task 3.1 — PlayerSearchScreen: use get_players_nearby RPC ✅

**File:** `src/lib/queries/players.ts`

**Status:** ✅ Complete

**Implementation:**
- Created `fetchNearbyPlayers(lat, lng, radiusKm, skillLevel, nameQuery)` that calls `get_players_nearby` RPC
- Refactored `searchPlayers()` to delegate to RPC when coordinates available, fallback to basic query otherwise
- Removed all client-side Haversine distance calculations
- Added client-side name filtering after RPC results (since RPC doesn't support text search)

**Acceptance criteria:** ✅ Player search results ordered by real PostGIS distance. Skill level filtering works. No client-side distance math.

---

### Task 3.2 — VenueFilter: add amenities chips ✅

**Files:** `src/screens/VenueFilterScreen.tsx`, `src/lib/queries/venues.ts`

**Status:** ✅ Complete

**Implementation:**
- Added `AMENITIES_OPTIONS` constant with 8 amenity types: bar, parking, accessible, pro_shop, coaching, showers, wifi, food
- Added `selectedAmenities` state and `toggleAmenity()` handler
- Added Amenities section UI with `FilterChip` components for multi-select
- Updated `VenueFilters` interface to include `amenities: string[]`
- Added client-side amenities filtering in `fetchNearbyVenues()` using `filters.amenities.every(required => venueAmenities.includes(required))`

**Acceptance criteria:** ✅ User can select multiple amenities. Venue map only shows venues with all selected amenities.

---

### Task 3.3 — VenueDetail: is_open_now badge ✅

**File:** `src/screens/VenueDetailScreen.tsx`

**Status:** ✅ Complete

**Implementation:**
- Added `isOpenNow(openingHours)` helper function that:
  - Parses JSONB format: `{monday: {open: "9am", close: "10pm"}, ...}`
  - Maps day of week (0-6 to sunday-saturday)
  - Parses time strings ("9am", "10pm") to minutes since midnight
  - Compares current time to opening hours
  - Returns `true` (open), `false` (closed), or `null` (unparseable/missing data)
- Added `openStatus` variable calculation before return statement
- Added conditional badge rendering in venue header chips row:
  - "Open now" (green background) when open
  - "Closed" (red background) when closed
  - No badge when opening hours unavailable

**Acceptance criteria:** ✅ Venues with parseable opening hours show live open/closed badge. Venues without hours show no badge.

---

## Phase 4 — Real-time & Feed Enhancements ✅ COMPLETE

> These add live data updates and richer feed interactions.

### Task 4.1 — Match status: Realtime subscription ✅

**File:** `src/screens/MatchDetailScreen.tsx`

**Status:** ✅ Complete

**Implementation:**
- Added local match state (`useState<Match | null>`) that gets updated from both store and Realtime
- Added Realtime subscription via `supabase.channel(\`match-${matchId}\`)` listening for UPDATE events on matches table
- Match data updates in real-time when opponent accepts/declines/cancels
- Subscription cleanup on unmount via useEffect return

**Acceptance criteria:** ✅ Match status changes reflect immediately without manual refresh. Status badges and action buttons re-render reactively.

---

### Task 4.2 — Chat: message pagination ✅

**Files:** `src/screens/ChatScreen.tsx`, `src/stores/messagesStore.ts`, `src/lib/queries/messages.ts`

**Status:** ✅ Complete

**Implementation:**
- Modified `fetchMessages()` to accept `limit` and `before` timestamp parameters for pagination
- Updated `messagesStore` to add:
  - `hasMoreMessages: boolean` flag
  - `isLoadingMore: boolean` flag
  - `loadEarlierMessages()` function that fetches 30 older messages before the oldest current message
- `openConversation()` now loads only the latest 30 messages initially
- ChatScreen displays "Load earlier messages" button when `hasMoreMessages === true`
- Button hidden when all messages loaded

**Acceptance criteria:** ✅ Initial load fetches 30 messages. "Load earlier" button fetches previous 30. Realtime subscription still appends new messages at bottom.

---

### Task 4.3 — MyProfile: full achievements grid with locked items ✅

**Files:** `src/screens/MyProfileScreen.tsx`, `src/lib/queries/profile.ts`, `src/lib/types.ts`

**Status:** ✅ Complete

**Implementation:**
- Added `AchievementWithStatus` interface extending Achievement with `earned: boolean` and `earned_at: string | null`
- Added `fetchAllAchievements()` query to fetch all achievements from DB
- Added `fetchAchievementsWithStatus(userId)` that:
  - Fetches all achievements AND user's earned achievements in parallel
  - Merges them into AchievementWithStatus array
  - Sorts: earned first (newest first), then locked by sort_order
- Updated MyProfileScreen to:
  - Display all achievements (not just earned ones)
  - Show earned achievements with colored icon, gradient background, earned date
  - Show locked achievements with greyed icon, "LOCKED" label, reduced opacity
  - Removed `.slice(0, 4)` limit to show full grid

**Acceptance criteria:** ✅ All achievements visible. Earned highlighted with color and date. Locked greyed out. Users can see what to work towards.

---

### Task 4.4 — Match score & winner recording ✅

**Files:** Migration `011_match_results.sql`, `src/screens/MatchDetailScreen.tsx`, `src/lib/queries/matches.ts`

**Status:** ✅ Complete

**Implementation:**
- **Migration 011**: Added `score_player_1 INT`, `score_player_2 INT`, `winner_id UUID` columns to matches table
- **Match interface**: Added score and winner fields to Match TypeScript interface and mapMatch function
- **All match queries**: Updated fetchMyMatches, fetchUpcomingMatches, fetchMatchById to select new columns
- **recordMatchScore()** query: New function that updates scores, winner_id, and sets status to 'completed'
- **MatchDetailScreen**:
  - Changed "Mark as Completed" button to "Complete Match & Record Score" that opens modal
  - Added score modal with two number inputs for each player's score
  - Auto-computes winner based on scores
  - Submit calls `recordMatchScore()` then refreshes match via Realtime/store
  - Added score display card for completed matches showing final score and winner highlight
- **Realtime integration**: Score updates appear immediately after submission via existing Realtime channel

**Acceptance criteria:** ✅ Users can record scores when completing matches. Winner shown with green badge and "WINNER" label. Score displays on MatchDetail for completed games.

---

## Phase 5 — Social & Safety Features

> These complete the social graph and give users control over unwanted interactions.

### Task 5.1 — Block / Remove connection

**Files:** `src/screens/PlayerProfileScreen.tsx`, `src/screens/ConnectionsListScreen.tsx`, `src/stores/connectionsStore.ts`, `src/lib/queries/connections.ts`

**Problem:** Once connected, there is no way to remove a connection or block a user. This is a basic safety feature.

**Steps:**
1. **DB migration** `012_block_connection.sql`:
   ```sql
   ALTER TABLE connections
     ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES profiles(id);
   CREATE INDEX IF NOT EXISTS idx_connections_blocked ON connections(blocked_by) WHERE blocked_by IS NOT NULL;
   ```
   Add RLS: users can only set `blocked_by` on their own connections.
2. **`src/lib/queries/connections.ts`** — Add:
   - `removeConnection(connectionId)` — delete the row
   - `blockUser(connectionId, blockedById)` — set `blocked_by = blockedById`
3. **`src/stores/connectionsStore.ts`** — Add `remove(connectionId)` and `block(connectionId)` actions that call the above queries and refresh state.
4. **`src/screens/PlayerProfileScreen.tsx`** — Add a ⋯ menu button (top-right) for connected players with options: "Remove Connection", "Block User". Confirm before acting.
5. **`src/screens/ConnectionsListScreen.tsx`** — Add swipe-to-reveal or long-press menu on Connections tab items with the same options.
6. Ensure blocked users do not appear in PlayerSearch or HomeFeed results (add `.not('blocked_by', 'is', null)` filter or handle in RLS).

**Acceptance criteria:** A user can remove or block any accepted connection. Blocked users no longer appear in search. The action is confirmed before proceeding.

---

### Task 5.2 — Native Google Maps (MapScreen) — Performance Upgrade

**File:** `src/screens/MapScreen.tsx`

**Problem:** MapScreen uses `@react-google-maps/api` which renders via WebView. On Android this is noticeably slower than the native tile layer provided by `@capacitor/google-maps`.

**Steps:**
1. Install `@capacitor/google-maps` and sync: `npm install @capacitor/google-maps ; npx cap sync android`
2. Add Google Maps API key to `android/app/src/main/AndroidManifest.xml` meta-data tag.
3. Rewrite `MapScreen.tsx` to use `<CapacitorGoogleMaps>` native map element.
4. Port: initial camera position from geolocation, venue markers with custom icons, InfoWindow → native `addMarker` with info window, recenter button calling `map.setCamera()`.
5. Keep the venue pull-up sheet (bottom drawer) — it renders above the native map as a React overlay.
6. Conditional render: web preview (Vite dev server) keeps `@react-google-maps/api`; Capacitor native build uses `@capacitor/google-maps`.

**Acceptance criteria:** On an Android device, the map loads faster and scrolls smoothly. Pin tap still opens the venue pull-up sheet. Web dev server still shows the Google Maps WebView version.

---

## Phase 6 — QA & Polish

> Final pass before release candidate.

### Task 6.1 — End-to-end smoke test all critical flows

Manual test plan:
- [ ] Register → Onboarding → ProfileSetup → MainShell
- [ ] Search players by distance + skill; connect; accept connection
- [ ] Schedule a match; opponent accepts; score recorded; HomeFeed shows result
- [ ] Check in at a venue; write a review; venue shows updated rating
- [ ] Receive each notification type; tap → deep-link works
- [ ] Messages tab badge clears after reading
- [ ] Delete account → all stores reset → back to Onboarding

### Task 6.2 — Type safety audit

- Replace all `any[]` types in stores (connectionsStore `pending`, `sent`)
- Ensure all query functions have explicit return types
- Run `tsc --noEmit` with zero errors

### Task 6.3 — Error boundary & toast coverage

- Every store action that can fail should call a toast notification on error (not just console.error)
- Add a top-level React `ErrorBoundary` in `App.tsx` to catch unexpected crashes

---

## Progress Tracker

| Phase | Task | Status |
|-------|------|--------|
| 1 | 1.1 Notification type enum fix | ✅ Complete |
| 1 | 1.2 connectionsStore.respond bug | ✅ Complete |
| 1 | 1.3 Migration 009 double-trigger | ✅ Complete |
| 2 | 2.1 Write a Review | ✅ Complete |
| 2 | 2.2 Dynamic nav badge counts | ✅ Complete |
| 2 | 2.3 Notifications deep-link routing | ✅ Complete |
| 3 | 3.1 PlayerSearch use RPC | ✅ Complete |
| 3 | 3.2 VenueFilter amenities chips | ✅ Complete |
| 3 | 3.3 VenueDetail is_open_now badge | ✅ Complete |
| 4 | 4.1 Match Realtime subscription | ✅ Complete |
| 4 | 4.2 Chat pagination | ✅ Complete |
| 4 | 4.3 Full achievements grid | ✅ Complete |
| 4 | 4.4 Match score & winner recording | ✅ Complete |
| 5 | 5.1 Block / remove connection | ⬜ Not started |
| 5 | 5.2 Native Google Maps | ⬜ Not started |
| 6 | 6.1 E2E smoke test | ⬜ Not started |
| 6 | 6.2 Type safety audit | ⬜ Not started |
| 6 | 6.3 Error boundary & toast coverage | ⬜ Not started |
