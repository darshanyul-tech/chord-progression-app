# 17 — Stats, Logging & Optional Profiles

Persistent performance analytics (per-topic accuracy, plus a per-item breakdown
where one exists) and **optional** local profiles, built so they migrate onto a
cPanel PHP + MySQL backend by setting one env var — no UI or call-site changes.

## Goals

- Every topic records **overall accuracy** that survives reloads (unlike the
  session score in `state/scores.ts`, which is per-session by design D6).
- Topics with a natural item axis also record a **per-item** breakdown
  ("Minor 6th — 58% (11/19)"): interval / chord / scale / meter recognition.
- The app stays **fully usable anonymously** (Guest). Signing into a named
  profile is optional and, once the backend is live, syncs across devices.
- **Backend-portable**: local `localStorage` today; cPanel PHP + MySQL later,
  swapped in one place.

## Architecture

Two ports (interfaces) with a local and a cPanel implementation each:

```
UI (StatsPage, ProfileMenu)
        │
state/statsStore.ts ─ state/profileStore.ts   (zustand)
        │                     │
lib/stats/backend.ts   lib/auth/authClient.ts   ← the swappable PORTS
   ├ LocalStatsBackend    ├ LocalAuthClient      (localStorage — default)
   └ CpanelStatsBackend   └ CpanelAuthClient     (fetch → PHP; inert until env set)
```

- **`lib/stats/`** (Tier-1, framework-free, unit-tested)
  - `types.ts` — `AttemptEvent`, `Tally`, `TopicStats`, `StatsData` (the same
    JSON shape stored locally and in MySQL).
  - `aggregate.ts` — pure `applyEvent` / `mergeStats` / `accuracy(Pct)`.
  - `backend.ts` — `StatsBackend` port + `createStatsBackend()` env switch.
- **`lib/auth/`** — `authClient.ts` (`AuthClient` port) + `token.ts` (shared
  bearer-token accessor).
- **`state/`** — `statsStore.ts` (active-profile stats in memory, debounced
  save) and `profileStore.ts` (profile list + active profile, drives the stats
  store). `scores.ts` `recordAttempt(topicId, correct, item?)` forwards every
  attempt into the stats store — this is the single wiring point.

### The one invariant to respect

`applyEvent` bumps `overall` on **every** event, and also the item tally when
`itemKey` is set. So emit **exactly one `recordAttempt` per graded attempt**.
A topic with orthogonal sub-scores (e.g. Chord Progressions' function/tonality)
records only its overall result here; its detailed split stays in its own
session UI. To add a rolling-window metric later, extend `aggregate.ts` — no
call-site changes needed.

### Profile namespacing

`Guest` progress is **always device-local** (there is no account to sync it to).
Named profiles use the configured backend — local now, cPanel once
`VITE_API_BASE_URL` is set. `statsStore.importGuest()` merges the device's guest
progress into a signed-in profile.

## Migrating to the cPanel backend

Everything for the server lives in `server/cpanel/` (see its `README.md`).

1. Create a MySQL DB + user in cPanel; import `server/cpanel/schema.sql` via
   phpMyAdmin.
2. Upload `auth.php`, `stats.php`, `db.php`, `.htaccess` to
   `public_html/api/`; copy `config.sample.php` → `config.php` and fill in
   credentials.
3. Set `VITE_API_BASE_URL=https://<your-domain>/api` and rebuild the frontend.

`createStatsBackend()` / `createAuthClient()` then return the `Cpanel*`
implementations automatically. Nothing else changes.

### REST contract (what the PHP implements)

Auth token is stored in `localStorage` (`eartrainer.v1.auth.token`) and sent as
`Authorization: Bearer <token>`.

| Method & path | Body | Response |
|---|---|---|
| `POST auth.php?action=register` | `{name, pin?}` | `{profile, token}` |
| `POST auth.php?action=login` | `{id, pin?}` | `{profile, token}` |
| `POST auth.php?action=list` | `{}` | `[profile]` (the authed profile) |
| `POST auth.php?action=delete` | `{id}` | `{ok:true}` |
| `GET  stats.php` | — | `StatsData` \| `204` |
| `PUT  stats.php` | `StatsData` | `{ok:true}` |
| `POST telemetry.php` | `{deviceId, name?, stats}` | `{ok:true}` |
| `GET  admin.php?key=…[&format=json]` | — | HTML \| JSON aggregate |

`profile = {id, name, createdAt}`. `StatsData = {version, topics, updatedAt}`.

## Owner-side usage analytics (telemetry)

Separate from the per-account sync above and aimed at the **site owner**: how
many people use the app and what they practise, **including anonymous guests**.

- `lib/stats/device.ts` mints a stable anonymous `deviceId` (random UUID in
  `localStorage`, key `eartrainer.v1.device.id`). No PII, no fingerprinting.
- `lib/stats/telemetry.ts` `sendTelemetry(name, data)` posts `{deviceId, name,
  stats}` to `telemetry.php`. `statsStore` fires it on the same debounced tick
  as a save, and on reset. `name` is the display name **only when signed in**,
  else `null`. **No-op unless `VITE_API_BASE_URL` is set** — nothing leaves the
  device in local mode.
- Backend `telemetry.php` upserts one row per device into `usage_stats`;
  `admin.php` (protected by `config.admin_key`) aggregates every row into the
  owner dashboard: distinct devices, registered accounts, attempts + accuracy,
  active-7/30-day counts, per-topic usage, and named accounts.

Only the aggregate `{topics:{overall,items}}` blob is sent — never a raw
per-question log. See `server/cpanel/README.md` for the privacy summary to
surface to visitors.

## Storage keys (local mode)

| Key | Contents |
|---|---|
| `eartrainer.v1.stats.<profileId>` | that profile's `StatsData` |
| `eartrainer.v1.auth.profiles` | local named profiles (with PIN hash) |
| `eartrainer.v1.auth.active` | last-active profile id |
| `eartrainer.v1.auth.token` | bearer token (backend mode only) |
| `eartrainer.v1.device.id` | anonymous device id for usage telemetry |

## Adding a per-item breakdown to another topic

In that topic's `usePractice` `finalize()`, pass a third arg to `recordAttempt`:

```ts
recordAttempt(TOPIC_ID, firstGuessCorrect, { key: question.id, label: question.label });
```

Overall accuracy needs nothing — it is recorded for every topic automatically.
