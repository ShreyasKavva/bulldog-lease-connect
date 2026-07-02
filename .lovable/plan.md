## Goal

Rebuild `/` as an Airbnb-style, fully public browsing experience. Anyone (logged in or not) sees the same home. Auth is only required when a user tries to **post a listing** or **message a seller** — everything else (browse, search, filter, open listing detail, view photos, view profile card) is open.

## New homepage layout (matches reference)

Top bar (sticky, white):
- LeaseUp wordmark (left)
- Center category tabs: **All · Homes · Rooms · Sublets** (visual only in v1, filters `listing.type`)
- Right: `Become a host` → opens Post Listing (auth-gated), globe/menu button

Search pill (centered under top bar, rounded, shadow):
- **Where** — campus/city autocomplete (uses existing `campuses` list + free-text neighborhood)
- **When** — date range (move-in / move-out) using existing `Calendar` component
- **Who** — guests/roommates stepper (1–6)
- Red circular search button

Below search:
- "Continue searching…" recent-search chip (localStorage of last query)
- **Based on your search** horizontal rail (filtered listings, arrow scroll)
- **Stay near {campus}** rails — one per nearby/popular campus
- **Trending on LeaseUp** rail (reuses `TrendingCarousel`)
- Cards use existing `ListingCard` styling but Airbnb-shaped: rounded 16px image, heart top-right, "Guest favorite" pill top-left when `is_verified` or SafeScore ≥ 80, price + rating below.

Footer: simple links (About, Safety, Terms).

Bottom nav stays for logged-in users only; guests get no bottom nav (Airbnb-like).

## Auth gating (the key behavior change)

Remove the current guest-vs-user split. Both see the same page. Auth prompts only fire on:

1. **Post a listing** — `Become a host` button, any "+ Post" CTA, empty-state post buttons → if `!user`, route to `/auth?mode=up&next=/?post=1`; after login, auto-open `PostListingDialog`.
2. **Message seller** — inside `ListingDetailSheet`, the "Message" button → if `!user`, route to `/auth?mode=in&next=/?listing={id}&message=1`; after login, auto-open the listing and start the conversation.
3. **Save (heart)** — same pattern, `next=/?listing={id}&save=1`. (Small addition; matches Airbnb.)

Everything else — opening a listing sheet, viewing photos, viewing seller profile card, using search/filters, browsing rails — works without login.

The `/auth` route already accepts a `mode` search param; extend it to also accept `next` and redirect there on success.

## Files to change

- `src/routes/index.tsx` — replace the guest/user split with a single `AirbnbHome` component; keep sheets mounted; add the `?post=1` / `?message=1` / `?save=1` post-login handlers.
- `src/components/leaseup/AirbnbHome.tsx` *(new)* — top bar, search pill, rails.
- `src/components/leaseup/SearchPill.tsx` *(new)* — Where/When/Who control.
- `src/components/leaseup/ListingRail.tsx` *(new)* — horizontal scroll rail with left/right arrows, reuses `ListingCard`.
- `src/components/leaseup/ListingCard.tsx` — add a compact "airbnb" variant (rounded, heart overlay, price + rating line). No behavior changes.
- `src/components/leaseup/ListingDetailSheet.tsx` — message/save buttons call a passed `requireAuth()` helper instead of assuming a session.
- `src/routes/auth.tsx` — accept optional `next` search param; on successful sign-in/up navigate to `next` (default `/`).
- `src/components/leaseup/BottomNav.tsx` — only render when `user` is present (already the case on most routes; verify).

Map view isn't removed — it moves to `/map` (existing `MapHome` component gets its own tiny route file), reachable from a "Show map" toggle on the search pill. Not the default anymore.

## Out of scope (this change)

- Real geocoded "Where" search beyond campus list + city string filter.
- Actual date-availability filtering on listings (dates are stored on the search state and passed into filters as `available_from/to` overlap — simple overlap check on `listing.start_date`/`end_date`).
- Redesigning `ListingDetailSheet` internals; just swap the auth gate.

## Verification

- Signed-out: land on `/`, see rails, open a listing, browse photos — no auth prompt.
- Click "Message host" signed-out → `/auth?mode=in&next=/?listing=X&message=1` → after login, listing reopens and message thread is created.
- Click "Become a host" signed-out → `/auth?mode=up&next=/?post=1` → after login, Post dialog opens.
- Signed-in: same page, plus bottom nav; posting/messaging never redirect.
