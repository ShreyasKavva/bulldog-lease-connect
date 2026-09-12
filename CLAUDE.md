# CLAUDE.md — LeaseUp

Context file for Claude Code working in this repo. Read this before
touching anything; it exists so you don't re-derive the same facts every
session and don't break things that are already correct.

**What this is:** LeaseUp is a student sublease marketplace. Students
post a sublease near their campus; other students find it and message
the poster directly. Free to message. Live at **leasup.co**.

**How it's built:** the app is authored in **Lovable** (project *Athens
Sublet Hub*, id `7f8884e2-8821-4ca5-9a4a-28b69a17d87c`, subdomain
`bulldog-lease-connect`). This repo is Lovable's two-way Git sync: edits
made in Lovable land here as commits, and commits pushed to `main` are
pulled back into the Lovable project. **That makes `main` shared mutable
state between you and a live editor.** See "Working alongside Lovable".

---

## Stack

| | |
|---|---|
| Framework | TanStack Start v1 (file routes in `src/routes/`) |
| UI | React 19 |
| Build | Vite 7 |
| Styling | Tailwind v4 |
| Backend | Supabase (Lovable Cloud) |
| Maps | Leaflet |

**SSR is on** (`src/server.ts`, `src/start.ts`). Every browser-only API
— `window`, `document`, `localStorage`, Leaflet, anything touching
`navigator` — must be guarded or lazily imported, or you ship a
hydration crash. This is the single most common way to break this app.

### Commands — verified against `package.json` 2026-09-12

**This project uses Bun**, not npm. `bun.lock` and `bunfig.toml` are the
real lockfile and config.

| Task | Command |
|---|---|
| Install | `bun install` |
| Dev server | `bun run dev` |
| Build | `bun run build` |
| Build (dev mode) | `bun run build:dev` |
| Preview build | `bun run preview` |
| Lint | `bun run lint` |
| Format | `bun run format` |
| **Typecheck** | `bunx tsc --noEmit` |

Two gaps you must know about:

1. **There is no `typecheck` script.** `package.json` defines only
   `dev`, `build`, `build:dev`, `preview`, `lint`, and `format`. Run
   `bunx tsc --noEmit` directly. Anything that says "run typecheck"
   means this command.
2. **There is no test runner and there are no tests.** No vitest, no
   jest, no playwright, no test script. So "tests pass" is not a gate
   that exists yet — the manual checklist under "Testing and
   verification" is the only safety net. Building a Playwright suite is
   the highest-leverage task available in this repo.

Also: a `package-lock.json` exists alongside `bun.lock`, and
`package.json` carries a `pnpm.overrides` block. Three package managers
are implied by the repo contents. **Use Bun** and don't "clean this up"
as a drive-by — untangling it is its own task with its own risk.

---

## Routes

`/` · `/browse` · `/subleases` · `/looking` · `/messages` ·
`/my-listings` · `/listing/$id` · `/post` · `/about` · `/ambassador` ·
`/admin` · `/tours` · `/market` · `/sublease/$slug`

- `/sublease/$slug` is the **campus landing page**. ~3,900 campuses
  exist; only ~19 have listings.
- A near-duplicate `/campus/$slug` also exists. **Known. Leave it
  alone** — deleting it is a feature removal and needs a human decision.
- Mobile bottom nav shows **Home · Browse · Messages · Saved · Post**.
  "Saved" has no obvious route in the list above — check where it points
  before assuming it's broken or missing.

---

## Data model

### `listings`

| Column | Notes |
|---|---|
| `price` | **NOT `rent`.** Most common mistake in this codebase. |
| `photos` | Storage **paths**, not URLs. Signed on read and exposed as `photo_urls`. Never render `photos` directly. |
| `beds`, `area` | |
| `available_from`, `available_to` | |
| `status`, `is_active` | |
| `view_count`, `saves_count`, `message_count` | |
| `roommate_prefs` | jsonb |
| `is_featured`, `display_name`, `user_id`, `campus_id` | |

"Bump" updates `updated_at`. **There is no `bumped_at` column** — don't
write one, don't query one.

### `conversations`

`participant_1_id`, `participant_2_id`, `listing_id`, `looking_post_id`,
`last_message_at`. `getOrCreateConversation` sorts the two user ids
before insert — that ordering is what keeps conversations unique. Don't
change it.

### `messages`

`conversation_id`, `sender_id`, `recipient_id`, `content`, `read`.

### `looking_posts`

The roommate board. **The user-facing name is "Roommate Search"** — never
"looking posts" in UI copy.

### `campus_notify_signups`

**Known open security issue.** The INSERT policy accepts any `email`
and any `user_id` with **no ownership check**, so an anonymous user can
insert arbitrary emails tied to any account. This is real and unfixed.
Tightening it is the highest-priority backend task.

---

## Things that are already correct — do not "fix" them

These have been reviewed. Changing them is a regression, not an
improvement.

- **RLS on `conversations` and `messages` is symmetric and correct.**
  Never rewrite it.
- **The public read policy on active listings is intentional.** Browsing
  works signed out by design. Never restrict it.
- **Approximate map pin locations are a privacy decision**, not a bug.
- **Map attribution must stay visible.** Legally required.
- Two prior security scan findings are **false positives** whose own
  bodies say no exposure exists: "listing share event rows readable only
  by owner", and "users cannot manage stale notify signups". Don't
  re-litigate them. Only the `campus_notify_signups` one is real.

---

## Shared modules — use these, don't reimplement

| Module | Use for |
|---|---|
| `src/lib/leaseup/queries.ts` | Data access. Don't hand-roll Supabase queries next to it. |
| `src/lib/leaseup/display-name.ts` | `posterName()` / `conversationName()`. All user-facing names go through these. |
| `src/lib/leaseup/map-tiles.ts` | `BASEMAP_URL` (CARTO Voyager). **Never inline a tile URL anywhere.** |

---

## Design system

- Primary: **Indigo `#4F46E5`**
- Cards: `rounded-2xl` · Pills/chips: `rounded-full`
- **Mobile-first, 375px is the reference width.** Check it every time.
- Match surrounding style exactly. This codebase is largely
  Lovable-authored; a patch that looks foreign invites Lovable to
  "helpfully" rewrite it later and undo you.

---

## Product rules — non-negotiable

1. **No paywall on messaging.** Messaging is free and stays free.
2. **No "matching" language.** This is search, not a matching algorithm.
   Don't write copy that implies otherwise.
3. **Never show a zero count to a renter.** No "0 listings", no
   "Upvote 0", no zero stat tiles. Suppress the element or show a real
   empty state.
4. **No fabricated business names or fake data in seed content.** An
   investor who spots one fake number discounts every number.
5. **Never inflate the campus count.** ~3,900 campuses exist in the
   table; only ~19 have listings. The homepage and footer show only the
   real ones. That honesty is the point.
6. **Never remove an existing feature** without a human decision.

---

## The demo path

This is the walk that matters. A defect here is P1; everywhere else is
lower no matter how ugly.

```
homepage -> /browse (grid AND map) -> listing detail -> message the poster -> /market
```

Plus `/post` for "students can list in 60 seconds".

The ~3,900 empty campus pages are permanently low priority — nobody on
the demo path will open one.

---

## Testing and verification

There is **no regression test suite yet.** Building one (Playwright over
the demo path) is the highest-leverage thing available in this repo.

Until then, before you push, by hand:

1. `bunx tsc --noEmit` passes (there is no `typecheck` script).
2. `bun run lint` passes.
3. `bun run build` passes.
4. You loaded the affected surface **in its default state** — signed
   out, hard refresh, cache-busting query. **Never clear a filter to
   make something look right. Wrong on arrival IS the bug.**
5. You loaded **`/browse`**. Do this whatever you changed — `/browse`
   has been broken by "unrelated" changes at least three separate times.
6. **375px**: no clipping, overlap, or mid-word wrapping.

Verify against the deployed URL, **not** the Lovable editor iframe. The
iframe has repeatedly failed to reproduce real bugs.

What to hunt for, generally: anything 0/empty/broken *on arrival*;
placeholder data; text that clips or wraps mid-word; dates missing
years; literal `null` / `undefined` / `NaN` / `?` in rendered text; CTAs
that don't read as clickable; error boundaries; console errors; title or
meta tags that change after hydration.

---

## Working alongside Lovable

`main` is shared with a live editor and two build agents. Treat it
accordingly. **`AGENTS.md` in this repo says the same thing** — it is
Lovable's own template warning, and it does not conflict with anything
here: don't rewrite published history, and keep the branch in a working
state because commits sync back into the editor.

Repo: `github.com/ShreyasKavva/bulldog-lease-connect` (private), synced
branch `main`, ~2,176 commits of history carried over.

- **Never force-push. Never rewrite history.** A force-push can destroy
  work that exists in Lovable but hasn't been published yet.
- **Never work on a branch other than `main`** without a human yes —
  Lovable syncs `main` specifically.
- One focused commit per fix. Message: `fix(<surface>): <what>`.
- **Smallest correct change.** No drive-by refactors, no reformatting,
  no dependency bumps riding along. Large diffs are how you collide with
  a concurrent Lovable edit.
- **No new dependencies without a human yes.**
- Pushing does **not** publish. A human or a builder agent still has to
  click **Publish changes** in Lovable for it to reach leasup.co.
- Never send prompts to Lovable's chat from here — that spends credits
  and belongs to the builder agents.

---

## Current state, as observed on live leasup.co (2026-09-12)

Snapshot for orientation. Re-check before relying on any number.

- Homepage stats: **113 subleases posted · 19 campuses · Free to message
  a poster**
- `/browse`: 113 subleases; Grid / List / Map views; sort Newest; filters
  for size, Furnished, Utilities, Parking, Pets OK, WiFi, Laundry,
  Verified; "Save search"; "Trending this week" rail
- Campus pages render hero, filter pills, results count, sort,
  grid/empty state, "How LeaseUp works at X", other campuses,
  GroupMe/Discord share, post CTA
- Page titles: `LeaseUp — Student Subleases Near Your Campus` ·
  `Browse Subleases Near Campus | LeaseUp` ·
  `Sublease Prices — Market Data | LeaseUp` ·
  `Roommate Search — Post What You Need — LeaseUp`

### Open items

- **`campus_notify_signups` INSERT policy** — real, unfixed, highest
  priority.
- **Unexplained count mismatch, worth investigating before trusting
  either number:** the campus grid lists per-campus "live listings"
  (UGA 25, UVA 20, Ohio State 15, UT Austin 15, Georgia Tech 12, then
  6/6/5s) which sum to roughly 159, while the homepage and `/browse`
  both report **113 subleases**. UGA's own campus page meanwhile shows
  **9 listings** and "LISTED THIS SEMESTER 9", not 25. These are
  probably three different definitions (all-time vs active vs
  this-semester) rather than a bug — but they are inconsistent to a
  visitor, and nobody has confirmed which is right. Don't "fix" any of
  them until you know what each query actually counts.
- `0 listings at {campus}` still renders on empty campus pages —
  violates the no-zero-counts rule.
- Every homepage listing reads "Posted 2 months ago".
- Roommate Search posts show "Active 48d ago" plus a redundant raw date.
- Save-heart has low contrast on light photos; wants a
  `bg-black/25` + `backdrop-blur-sm` scrim.
- Signed-out `/messages` renders a blank body until auth resolves — no
  signed-out state.
- `/about` claims "expanding to new campuses every semester", which
  contradicts the campus-density thesis the product is built on.

### Recently shipped

- **Q199** — campus hero stat strip now suppresses zero-value tiles,
  drops the always-zero "Students helped" metric, and falls back to
  "Be the first to list at {campus}." when all stats are zero.
  (`src/routes/sublease.$slug.tsx`)

---

## If something fails twice

Stop attempting it. Write up the diagnosis for a human instead of
looping. Two failed attempts across sessions means the mental model is
wrong, and a third attempt just burns time and risks `main`.
