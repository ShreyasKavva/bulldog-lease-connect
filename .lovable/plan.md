## Context

There is no dedicated listing detail route today — the whole product opens listings via a slide-in `ListingDetailSheet`. This queue calls for a real page. I'll add one at `/listing/$id` (since `/sublease/$slug` is already the campus page), keep the existing sheet intact for the fast "peek" flow on `/browse` and `/`, and add a "View full page" link inside the sheet that goes to the new route. Nothing on `/browse`, home, post flow, roommates, onboarding, or the schema will change.

## New route: `src/routes/listing.$id.tsx`

- SSR loader: fetch the listing with poster profile + campus, plus signed URLs for all `photos[]`. Throw `notFound()` when missing or `is_active=false && status!='filled'`.
- `head()`: title = listing title + campus short_name; description from first ~155 chars of listing description; `og:image` = first signed photo URL; canonical + og:url self-referencing.
- `errorComponent` + `notFoundComponent` + shared error page.
- Increments `view_count` on mount via the existing `increment_listing_view` RPC.

## Sections (top to bottom)

### PART A — Photo gallery (`ListingGallery` component)
- 0 photos → full-width neutral placeholder (muted background, home icon).
- 1 → single full-width image.
- 2–4 → Airbnb split: primary left (2 cols), 2×2 thumbs right.
- 5+ → same split with "Show all photos" button (bottom-right of primary).
- Height ~55vh on desktop (`h-[55vh]`), full-width edge-to-edge on mobile.
- Clicking any photo opens a lightbox (`PhotoLightbox` component: full-screen dialog, keyboard ← → esc, mobile swipe via touch handlers, index dots).

### PART B — Details column (left, `lg:col-span-2`)
- Title (`text-3xl font-black`).
- Sub-line: `{area} · {beds} bd · {baths} ba` (Studio when beds=0).
- Available: `{available_from → available_to}` formatted `MMM d, yyyy`.
- Price: `${price}/mo`.
- Amenities as chips with lucide icons (Sofa=Furnished, Snowflake=A/C, Car=Parking, WashingMachine=Laundry, PawPrint=Pet-friendly, Zap=Utilities inc.) — derived from booleans on `listings`.
- Description: full text; on mobile, clamp to 4 lines with "Read more" toggle.
- Meta line: "Posted {timeAgo} by {poster name}".

### PART C — Poster card (right, `lg:col-span-1`, `lg:sticky lg:top-20`)
Reuses avatar/emoji + banner color from the profile system:
- Avatar (emoji tile fallback), name (links to `/profile/$id`), `UGA · Junior` subtitle using the same abbreviator as the profile page, green ✓ .edu badge when `verified_email`, "Member since {Mon YYYY}", "{n} active listings" (uses `get_public_profile` RPC data or a light query).
- Primary CTA button:
  - Not signed in → `openSignIn("/messages/" + listing.id)`
  - Owner → `Edit listing` → `/my-listings`
  - Otherwise → navigate to `/messages/${listing.id}` (Q51 route)
- No response-rate line (we don't have it).

### PART D — Activity signals
Small muted row under the poster card: `Eye {view_count} views`, `Bookmark {saved_count}`, `Clock Listed {timeAgo}`. `saved_count` comes from a `saved_listings` count query alongside the loader.

### PART E — Similar listings
Server function `fetchSimilarListings({ id, campusId, price })` returns up to 3 active listings on the same campus with `price BETWEEN price-150 AND price+150`, `available_to >= today`, excluding the current id, ordered by `abs(price - target)`. Renders in a grid using the existing `ListingCard` (same as `/browse`). Section titled `Similar subleases at {campus.short_name}`. Omit entirely when zero matches.

### PART F — Mobile
- Single column below the gallery (poster card renders inline after details, before similar listings).
- Sticky bottom bar (`fixed bottom-0 inset-x-0 lg:hidden`) with price on the left and full-width primary "Message {FirstName} →" button. Adds `pb-24` to page container so content isn't hidden behind it.
- Swipeable carousel on `<md`: horizontal snap scroller with index dots; lightbox reused for full-screen.

## Wiring existing UI to the new route

- `ListingCard`: card click still opens the sheet (fast preview). Add a secondary "Open" affordance? Skip — keep card behavior unchanged to avoid scope creep on `/browse`.
- `ListingDetailSheet`: add a small "View full page →" link in the header that navigates to `/listing/$id` and closes the sheet. This gives users the shareable URL without disrupting the sheet flow.

## Technical notes

- Loader uses `context.queryClient.ensureQueryData` + `useSuspenseQuery` per the project's canonical read shape.
- All queries use the browser Supabase client with existing RLS — no schema changes, no new server functions with `requireSupabaseAuth` required.
- Photos are signed with `createSignedUrls` (5–10 min TTL) inside the loader; SSR-safe.
- Layout: `grid grid-cols-1 lg:grid-cols-3 gap-8`, details span 2, poster card spans 1.
- Reuses tokens (`bg-surface`, `text-primary`, `text-muted-foreground`); no hardcoded colors.
- New files:
  - `src/routes/listing.$id.tsx`
  - `src/components/leaseup/listing-detail/ListingGallery.tsx`
  - `src/components/leaseup/listing-detail/PhotoLightbox.tsx`
  - `src/components/leaseup/listing-detail/PosterCard.tsx`
  - `src/components/leaseup/listing-detail/AmenityChips.tsx`
  - `src/components/leaseup/listing-detail/MobileStickyCTA.tsx`
  - `src/components/leaseup/listing-detail/SimilarListings.tsx`
- Minor edit to `ListingDetailSheet` for the "View full page" link.

## Out of scope (as requested)

`/browse`, homepage, post flow, roommate pages, onboarding, database schema — untouched.

## Question before I build

The current sheet-based flow is deep (reactions, share, report, tour booking, secure deposit, price comparison, etc.). For this page, should I:
1. **Keep it lean** (spec-only: gallery, details, poster card, activity signals, similar) and leave sheet-only features (reactions, secure deposit, tour booking, report) in the sheet — the page becomes the shareable/SEO surface, the sheet stays the power UI.
2. **Port everything** from the sheet into the page too.

I'll default to option 1 unless you say otherwise — it matches the spec exactly and keeps the page focused on conversion.
