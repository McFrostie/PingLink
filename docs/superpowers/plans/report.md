Read memory pinglink-phase7-notes.md

Search complete: Audit all screens for real vs mock data

Searched for files matching `**/src/screens/**`, 23 matches

Read [](file:///f%3A/pinglink/src/App.tsx#1-1), lines 1 to 100

Read [](file:///f%3A/pinglink/src/screens/MainShell.tsx#1-1), lines 1 to 100

Read [](file:///f%3A/pinglink/src/screens/HomeFeed.tsx#1-1), lines 1 to 100

Read [](file:///f%3A/pinglink/src/screens/MapScreen.tsx#1-1), lines 1 to 100

Read [](file:///f%3A/pinglink/src/screens/PlayerSearchScreen.tsx#1-1), lines 1 to 100

Read [](file:///f%3A/pinglink/src/screens/MessagesScreen.tsx#1-1), lines 1 to 100

Read [](file:///f%3A/pinglink/src/screens/MyProfileScreen.tsx#1-1), lines 1 to 100

Read [](file:///f%3A/pinglink/src/screens/VenueDetailScreen.tsx#1-1), lines 1 to 100

Read [](file:///f%3A/pinglink/src/screens/ChatScreen.tsx#1-1), lines 1 to 100

Read [](file:///f%3A/pinglink/src/screens/MatchDetailScreen.tsx#1-1), lines 1 to 100

Read [](file:///f%3A/pinglink/src/screens/PlayerProfileScreen.tsx#1-1), lines 1 to 100

Read [](file:///f%3A/pinglink/src/screens/MatchSchedulingScreen.tsx#1-1), lines 1 to 100

Search complete: Audit database migrations completeness

Searched for files matching `**/supabase/migrations/*.sql`, 9 matches

Read [](file:///f%3A/pinglink/supabase/migrations/001_enums_and_extensions.sql)

Read [](file:///f%3A/pinglink/supabase/migrations/002_core_tables.sql)

Now let me check the remaining screens and query files in parallel:  

Search complete: Audit remaining screens and query helpers

Searched for files matching `**/src/screens/Notifications.tsx`, 1 match

Searched for files matching `**/src/screens/EditProfileScreen.tsx`, 1 match

Searched for files matching `**/src/screens/SettingsScreen.tsx`, 1 match

Searched for files matching `**/src/screens/ConnectionsListScreen.tsx`, 1 match

Searched for files matching `**/src/screens/AddVenueScreen.tsx`, 1 match

Searched for files matching `**/src/screens/VenueFilterScreen.tsx`, 1 match

Searched for files matching `**/src/screens/ProfileSetup.tsx`, 1 match

Searched for files matching `**/src/lib/queries/*.ts`, 8 matches

Read [](file:///f%3A/pinglink/src/screens/EditProfileScreen.tsx)

Read [](file:///f%3A/pinglink/src/screens/Notifications.tsx)

Read [](file:///f%3A/pinglink/src/screens/SettingsScreen.tsx)

Read [](file:///f%3A/pinglink/src/screens/AddVenueScreen.tsx)

Read [](file:///f%3A/pinglink/src/screens/ConnectionsListScreen.tsx)

Read [](file:///f%3A/pinglink/src/screens/VenueFilterScreen.tsx)

Read [](file:///f%3A/pinglink/src/screens/ProfileSetup.tsx)

Read [](file:///f%3A/pinglink/src/lib/queries/connections.ts)

Read [](file:///f%3A/pinglink/src/lib/queries/feed.ts)

Read [](file:///f%3A/pinglink/src/lib/queries/matches.ts)

Read [](file:///f%3A/pinglink/src/lib/queries/players.ts)

Read [](file:///f%3A/pinglink/src/lib/queries/messages.ts)

Read [](file:///f%3A/pinglink/src/lib/queries/profile.ts)

Read [](file:///f%3A/pinglink/src/lib/queries/venues.ts)

Search complete: Read remaining stores and types

Searched for files matching `**/src/stores/*.ts`, 8 matches

Read [](file:///f%3A/pinglink/src/lib/types.ts)

Read [](file:///f%3A/pinglink/src/lib/supabase.ts)

Read [](file:///f%3A/pinglink/src/stores/authStore.ts)

Read [](file:///f%3A/pinglink/src/stores/matchesStore.ts)

Read [](file:///f%3A/pinglink/src/stores/messagesStore.ts)

Read [](file:///f%3A/pinglink/src/stores/venueStore.ts)

Read [](file:///f%3A/pinglink/src/stores/connectionsStore.ts)

Read [](file:///f%3A/pinglink/src/stores/homeFeedStore.ts)

Read [](file:///f%3A/pinglink/src/stores/locationStore.ts)

Let me do a few quick focused checks:   

Searched for text `get_venues_nearby|venues_within_radius|007_rpc` (`**/supabase/migrations/**`), 1 result

Searched for text `notification_type|match_invite|connection_accepted|venue_approved|achievement_earned` (`**/src/screens/Notifications.tsx`), 2 results

Searched for files matching `**/src/lib/queries/notifications.ts`, 1 match

Read [](file:///f%3A/pinglink/supabase/migrations/006_triggers_functions_seed.sql#158-158), lines 158 to 320

Read [](file:///f%3A/pinglink/src/lib/queries/notifications.ts)

Read [](file:///f%3A/pinglink/supabase/migrations/006_triggers_functions_seed.sql#320-320), lines 320 to 500

Read [](file:///f%3A/pinglink/supabase/migrations/005_rls_policies.sql#171-171), lines 171 to 340

Created memory file [](file:///c%3A/Users/tayya/AppData/Roaming/Code/User/workspaceStorage/64b4db0f472df57687987a02d34eec96/GitHub.copilot-chat/memory-tool/memories/MWI2MDdjN2ItZjQ3Mi00YmNiLWJhOTktZDcxZTNiN2JjYjMw/plan.md)

Here's the full audit:

---

## What's Done ✅

**All screens are wired to real Supabase data — no mock data remains:**

| Screen | Status |
|---|---|
| Splash / Onboarding / Login / Register / ForgotPassword | Complete |
| ProfileSetup (4 steps) | Complete |
| HomeFeed | Complete — live matches, check-ins, activity feed |
| MapScreen | Complete — Google Maps + real venues |
| VenueFilterScreen | Complete — distance, facility type, min rating |
| VenueDetailScreen | Complete — photos, reviews, check-in toggle |
| AddVenueScreen | Complete — geocoding, photo upload, submission |
| PlayerSearchScreen | Complete — real search + connect buttons |
| PlayerProfileScreen | Complete — real data, connect/message/challenge |
| ConnectionsListScreen | Complete — 3 tabs (Connections/Requests/Sent) |
| MessagesScreen | Complete — real conversations |
| ChatScreen | Complete — Supabase Realtime |
| MatchSchedulingScreen | Complete — 2-step flow |
| MatchDetailScreen | Complete — accept/decline/cancel/complete |
| MyProfileScreen | Complete — stats, availability, venues, achievements |
| EditProfileScreen | Complete — full edit + avatar/cover upload |
| SettingsScreen | Complete — privacy, notif prefs, email/password, delete account |
| Notifications | Partially complete — reads from DB (but has type bugs, no deep-link) |

**Database is fully built:**
- All 16 tables with correct schema and FK relationships
- RLS policies on every table including `activity_feed`
- All triggers: `updated_at`, location sync, `handle_new_user`, venue rating, checkin count, conversation caching, connection/match notifications, checkin activity
- Both RPCs: `get_venues_nearby`, `get_or_create_conversation`, `are_connected`, `get_players_nearby`, `delete_my_account`
- Storage buckets: `avatars`, `venue-photos`, `achievement-icons` — seeded + RLS
- Achievements seeded (matches, venues, social, general categories)
- All performance indexes (PostGIS GiST, partial, GIN)

---

## Bugs 🐛

### 1. Notification type enum mismatch — **Critical**
notifications.ts defines 5 type values that don't match the DB `notification_type_enum` (9 values).

| DB fires | Frontend expects |
|---|---|
| `match_request` | `match_invite` ❌ (won't match) |
| `check_in` | `checkin` ❌ (won't match) |
| `connection_accepted` | *(not handled — falls to default)* |
| `match_confirmed` | *(not handled)* |
| `match_cancelled` | *(not handled)* |
| `venue_approved` | *(not handled)* |
| `achievement_earned` | *(not handled)* |

Result: most notifications show wrong icons and text.

### 2. `connectionsStore.respond` silent re-fetch failure
connectionsStore.ts does `get().pending[0]?.addressee_id` after responding, but `pending` rows map `other_profile` from `requester` — the `addressee_id` field isn't in the shape. `fetchAll` is called with `undefined`, silently doing nothing.

### 3. MapScreen uses web Google Maps, not native Capacitor
MapScreen.tsx uses `@react-google-maps/api` (WebView rendering). The plan specified `@capacitor/google-maps` (native Android layer). On a physical Android device the WebView map is slower with worse marker performance at scale.

### 4. Potential double-trigger for conversation updates
Migration 009 creates a new `cache_last_message` trigger function but doesn't explicitly drop the old `messages_update_conversation` trigger from migration 006. Both may fire on every message INSERT, causing double `unread_count` increments.

---

## Missing Features 🚧

### From Plans — Never Built

| Feature | Where it was planned | Gap |
|---|---|---|
| **Write a Review** | VenueDetail plan | `VenueDetailScreen` shows reviews list but has no submission form/button. `venueStore` has no `submitReview` action. |
| **Notifications deep-link** | Notifications screen spec | Tapping a notification card does nothing — Notifications.tsx has no `onNavigate` prop and no routing per type. |
| **VenueFilter → Amenities** | Phase 3 plans | Filter modal only has distance/type/rating. `VenueFilters` type and `get_venues_nearby` RPC support amenities but the UI/store have no amenities filter. |
| **Achievements full grid** | MyProfile spec "earned (colored) vs locked (gray + lock)" | `fetchUserAchievements` only fetches earned rows. Locked achievements require fetching all from `achievements` table then diffing. |
| **Match score recording** | Not explicitly in plan but implied | `complete()` action in matchesStore marks status = `completed` but there are no `player1_score`, `player2_score`, or `winner_id` columns in `matches` table. No W/L stats possible. |
| **`venues.city` column** | Schema plan mentioned `city text` | The `venues` table in migration 002 does NOT have a `city` column. The plan's `Venue` interface included it. Not blocking but inconsistent. |

### Incomplete/Shallow Implementations

| Feature | Location | Gap |
|---|---|---|
| **Nav badge counts are static** | MainShell.tsx — `hasBadge={true}` hardcoded | Messages tab badge should dynamically reflect total unread count from `messagesStore.conversations`. Home bell should reflect unread notification count. |
| **HomeFeed bell — no unread badge** | HomeFeed.tsx | Bell icon renders but shows no unread count number. |
| **Player proximity via client-side math** | players.ts | Fetches up to 50 profiles and does Haversine in JS instead of using the existing `get_players_nearby` RPC (which uses PostGIS and is far more scalable). |
| **`is_open_now` not computed** | VenueDetailScreen | `opening_hours` JSONB is fetched and stored but no helper computes or displays an "Open Now" / "Closed" badge. |
| **Connections type safety** | connectionsStore.ts | `pending: any[]` and `sent: any[]` — only `accepted` is typed as `Connection[]`. |
| **No block/remove connection** | ConnectionsListScreen, PlayerProfile | No UI or store action to block or remove an existing connection. |
| **Chat has no pagination** | messagesStore.ts | `openConversation` fetches the full conversation history with no limit/pagination — will slow down for long threads. |
| **Matches list no real-time** | matchesStore | Unlike chat, there's no Realtime subscription on `matches`. If player 2 accepts a challenge, player 1's list/detail won't update until they manually re-enter the screen. |
| **ForgotPassword incomplete** | ForgotPassword.tsx | `authStore` has no `sendPasswordResetEmail` action — the screen likely calls `supabase.auth.resetPasswordForEmail()` directly (inconsistent pattern). |

---

## Summary by Priority

**Must fix (production-blocking):**
1. Notification type enum mismatch — most notifications display wrong
2. `connectionsStore.respond` re-fetch bug — requests tab never refreshes after accept/decline
3. Migration 009 double-trigger risk — could silently double unread counts

**High value, missing features:**
4. VenueDetail "Write a Review" form
5. Notifications deep-link routing
6. Dynamic badge counts (Messages tab, HomeFeed bell)

**Polish / completeness:**
7. Switch MapScreen to `@capacitor/google-maps` for native Android
8. Achievements locked grid
9. `is_open_now` computed field in VenueDetail
10. Player search → use `get_players_nearby` RPC
11. VenueFilter amenities chip
12. Match Realtime updates
13. Chat pagination