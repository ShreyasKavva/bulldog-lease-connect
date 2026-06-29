# LeaseUp — Engineer Code Tour

> One-pass orientation for a new engineer. Read this top-to-bottom once; it maps every important folder, the data model, the auth & payment boundaries, and the gotchas that will bite you if you don't know them.

---

## 1. Stack at a glance

- **Framework:** TanStack Start v1 (React 19, Vite 7, SSR). Runs on a Cloudflare Worker (edge) — **not** Node. See `RUNTIME` warnings below.
- **Routing:** File-based, under `src/routes/`. Auto-generated registry at `src/routeTree.gen.ts` (do not edit).
- **Styling:** Tailwind v4, configured via CSS in `src/styles.css` (no `tailwind.config.js`). Theme tokens are oklch-based; dark mode toggled via `dark` class on `<html>` (see `src/lib/leaseup/theme.ts`).
- **Data:** Supabase (Postgres + Auth + Storage + Realtime). Schema lives in `supabase/migrations/`.
- **Server logic:** **`createServerFn`** RPC for app-internal logic (`src/lib/leaseup/*.functions.ts`). **Server routes** under `src/routes/api/public/*` only for webhooks/public APIs that need a raw `Response`.
- **AI:** Lovable AI Gateway (Gemini family by default). Wrapper in `src/lib/leaseup/ai-gateway.server.ts`.
- **Payments:** Stripe — Checkout for $9.99 listing boosts, PaymentIntent (manual capture) for deposit escrow. Webhook at `src/routes/api/public/stripe-webhook.ts`.
- **PWA:** Service worker registered from `src/lib/pwa/register.ts`. Manifest in `public/manifest.webmanifest`.

---

## 2. Folder map

```
src/
  router.tsx                  Per-request QueryClient + router config
  start.ts                    Server middleware (error page + Supabase bearer attach)
  styles.css                  Tailwind v4 + design tokens
  routes/
    __root.tsx                HTML shell, head, providers, listeners
    index.tsx                 HOME (map for guests, scroll feed for logged-in users)
    auth.tsx                  Sign-in / sign-up (email+password, Google OAuth)
    onboarding.tsx            5-step welcome flow (gated by profiles.onboarding_completed)
    profile.tsx               Current user profile + settings
    browse.tsx                Grid + map browse (alternate to scroll feed)
    my-listings.tsx           Poster dashboard; stats header + boost + escrow controls
    my-listings.$listingId.analytics.tsx   Per-listing analytics
    looking-for.tsx           "Looking For" board
    tours.tsx                 Tour scheduling dashboard
    roommates.tsx / .create   Roommate matching
    lease-analysis.tsx        AI lease review tool
    find-my-match.tsx         AI matchmaker quiz
    market.tsx                Public price intelligence page
    activity.tsx              Global anonymized activity feed
    saved.tsx alerts.tsx      Saved listings + saved-search alerts
    notifications.tsx         Notification center
    ambassador.tsx join.tsx   Referral program
    admin.tsx                 Admin/moderation dashboard
    sublease.$slug.tsx        SEO landing pages per campus
    sitemap[.]xml.ts          Generated sitemap
    api/public/
      stripe-webhook.ts       Stripe signature-verified webhook
    lovable/email/...         Lovable email provider integration (auto/transactional)
    email/unsubscribe.ts      One-click unsubscribe handler

  components/
    leaseup/                  All product UI (ListingCard, MapHome, ScrollView, etc.)
    ui/                       shadcn/ui primitives — DON'T put business logic here

  lib/leaseup/
    types.ts                  Source of truth for all domain types
    queries.ts                Client-side Supabase reads/writes (listings, msgs, saved)
    ai.functions.ts           AI server fns: lease analysis, match, screenListing
    ai-gateway.server.ts      Lovable AI Gateway provider wiring
    stripe.functions.ts       Server fns for boosts + deposit escrow
    stripe-client.ts          Lazy client-side Stripe.js loader
    admin.queries.ts          Admin reads + moderation writes
    analytics.queries.ts      Listing stats / growth charts
    reviews.queries.ts        Reviews CRUD
    tours.ts roommates.ts     Domain helpers
    pricing.ts                Fair-price classification (Deal/Fair/Above market)
    profile-completion.ts     Profile completeness scoring
    notification-meta.ts      Notification type → icon/label/route map
    campuses.ts constants.ts  Campus list, neighborhoods, amenities, time helpers
    referral.queries.ts       Ambassador + referral tracking
    reactions.ts activity.ts  Listing reactions + activity feed writers
    story-graphic.ts          Canvas-based Instagram Story image generator
    use-session.ts            useSession + useMyProfile hooks
    theme.ts                  Dark mode tokens

  lib/email-templates/        React Email templates (welcome, new-message, price-drop, etc.)
  lib/email/send.ts           Email send helper

  integrations/supabase/
    client.ts                 Browser Supabase client. **Auto-generated — do NOT edit.**
    client.server.ts          Service-role admin client. Top-level import ONLY from other .server.ts files.
    auth-middleware.ts        requireSupabaseAuth — gate server fns to authed users.
    auth-attacher.ts          Client-side middleware that attaches the bearer token.
    types.ts                  Generated DB types. Do NOT edit.

supabase/migrations/          SQL schema, RLS, triggers, pg_cron jobs
public/                       Static assets, PWA manifest, robots/sitemap fallbacks
```

---

## 3. Data model (high level)

All tables live in `public`. Every table has RLS enabled + explicit GRANTs (Lovable Cloud rule).

| Table | Purpose |
|---|---|
| `profiles` | One per auth user. Holds bio, vibe_tags, intent, onboarding_completed, is_admin, banned, verified_email, currently_status. **Email is private** (only owner can SELECT email). |
| `campuses` | All major US campuses. Seeded via migration. |
| `listings` | Subleases. 42 columns including SafeScore, view_count, status (`active`/`filled`/`inactive`), is_featured + featured_until, deposit_amount + deposit_escrow_enabled, pending_review, verification_tier. |
| `saved_listings`, `saved_searches` | Bookmarks + alerts (notify=true → email pipeline). |
| `looking_for_posts`, `looking_for_interests` | "Looking For" board. Auto-expires after 90 days via pg_cron. |
| `conversations`, `messages`, `message_reactions` | Threaded chat. Conversations are deduped by (p1,p2,listing). RLS only allows sender/recipient to read. |
| `notifications` | In-app notification center. Triggers populate from messages, price drops, boost activation, match alerts. |
| `lease_analyses` | Saved AI lease reports per user. |
| `reviews` | Post-sublease reviews. Feeds into SafeScore + verified badge. |
| `listing_reports`, `suspicious_listings` (view), `user_risk_scores` (view) | Moderation queue with priority scoring. |
| `roommate_profiles`, `roommate_interests` | Roommate matching with mutual-match trigger that opens a chat. |
| `boost_purchases`, `deposit_agreements`, `payment_intents` | Stripe records, written from webhook. |
| `tour_availability`, `tour_bookings` | Tour scheduling + .ics generation + post-tour survey via pg_cron. |
| `listing_reactions`, `listing_shares`, `listing_stats_daily`, `closed_deals` | Engagement + analytics. |
| `referral_events` | Ambassador program tracking. |
| `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails` | Email pipeline state for the Lovable transactional/auto email handlers. |

**Roles:** No `user_roles` table — admin is a boolean `profiles.is_admin` set manually via SQL/migration. (See `mem://` index — Queue 21 risk views read from this.) Privilege escalation is blocked by RLS: profiles cannot self-update `is_admin`.

---

## 4. Auth model

- **Provider:** Supabase Auth. Email+password (any domain) + Google OAuth.
- **`@uga.edu` auto-verify:** A DB trigger on `auth.users` flips `profiles.verified_email = true` when the signup email ends in `.edu`. Drives the green verified badge + SafeScore.
- **Session in the browser:** `import { supabase } from "@/integrations/supabase/client"`. Use `useSession()` / `useMyProfile()` hooks (`src/lib/leaseup/use-session.ts`).
- **Session on the server:** `createServerFn().middleware([requireSupabaseAuth])` injects `{ supabase, userId, claims }` onto `context`. The token is attached automatically by `attachSupabaseAuth` in `src/start.ts`.
- **Never** call a `requireSupabaseAuth` server fn from a public route's `loader` — SSR prerender has no bearer and the build will fail. Call from a component via `useServerFn` or only inside an `_authenticated` layout.
- **Admin gate:** Routes/UI check `profile.is_admin` client-side, but mutations must still pass RLS or call admin-only server fns.

---

## 5. Server-side patterns (CRITICAL)

The runtime is **Cloudflare Workers (workerd)**, not Node. With `nodejs_compat` we get `fs/path/crypto/Buffer/stream/url/events/http/https/zlib`. We do **not** get `child_process`, `sharp`, `canvas`, `puppeteer`, native binaries, or arbitrary FS.

### Rules

- `createServerFn` from `@tanstack/react-start` for everything app-internal. Chain shape: `createServerFn(...).middleware(...).inputValidator(...).handler(...)`. Validator MUST come before handler.
- Server routes (`createFileRoute` with a `server.handlers` block) **only** for webhooks/public APIs that need raw `Response` (e.g. Stripe webhook).
- Read `process.env.*` **inside** the handler, not at module scope. Module-scope reads can be undefined in some bundling paths.
- Never `import "@/integrations/supabase/client.server"` at the top of a `*.functions.ts` file — those modules are part of the client graph and only handler bodies are stripped. Use `const { supabaseAdmin } = await import(...)` inside the handler.
- `supabaseAdmin` bypasses RLS. Authorize the caller before using it (e.g. `has_role` check or explicit ownership query).
- Don't pass `Response`, streams, SDK clients, or class instances across the RPC boundary — return plain DTOs.

---

## 6. Payments (Queue 16/17)

- **Featured Listing Boost** ($9.99 / 7 days) — Stripe Checkout. Flow:
  1. `stripe.functions.ts::createBoostCheckout` (server fn, auth + ownership check) creates a Stripe Checkout Session + a `boost_purchases` row with status `pending`.
  2. User pays.
  3. Webhook `checkout.session.completed` → mark listing `is_featured=true`, set `featured_until = now+7d`, update `boost_purchases.status='paid'`, fire `boost_active` notification.
- **Deposit Escrow** — Stripe PaymentIntent with `capture_method=manual`. Funds are *authorized but held* (`status='held'`) until admin releases (capture) or refunds. Tracked in `deposit_agreements`. Webhook events:
  - `payment_intent.amount_capturable_updated` → `held`
  - `payment_intent.succeeded` (after capture) → `released`
  - `payment_intent.payment_failed` → `pending`
  - `charge.refunded` → `refunded`
- **Webhook URL:** `https://leasup.co/api/public/stripe-webhook`. Signature is verified using `STRIPE_WEBHOOK_SECRET`. **Do not skip verification.**
- **Required secrets:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`, `SITE_URL`. See `.notes/queue-17-stripe-action-items.md` for the human checklist of dashboard configuration we cannot automate.

---

## 7. AI (Lease Bot + Find My Match + Listing Screening)

- All AI calls go through `src/lib/leaseup/ai-gateway.server.ts` which wraps the **Lovable AI Gateway**. The model is configured at the top of `ai.functions.ts` (currently `google/gemini-3-flash-preview`).
- Required secret: `LOVABLE_API_KEY` (auto-provisioned by Lovable Cloud).
- `analyzeLease` accepts raw text or a base64 PDF; returns structured `{ summary, risk_score, flags[] }`. Persists to `lease_analyses`.
- `findMyMatch` takes a "vibe" quiz payload and returns ranked listings with reasons.
- `screenListing` is called from `PostListingDialog` before insert. Three outcomes:
  - `auto_reject` — block submit entirely (clear scam).
  - `pending_review` — insert with `pending_review=true`, surface in admin Suspicious tab.
  - `quality_nudge` — soft warning dialog before publishing.

---

## 8. Real-time and notifications

- Realtime subscriptions are used for chat messages, typing indicators, and notifications. Look at `MessagesSheet.tsx` and `NotificationToastListener.tsx`.
- DB triggers populate `notifications` for: new messages, price drops on saved listings, saved-search matches, boost activation, deposit held, mutual roommate match, tour requests.
- `NotificationToastListener` (mounted in `__root.tsx`) shows a toast for new rows; `NotificationsBell` shows the unread badge; `/notifications` is the full inbox with category filters.
- Email mirror of high-priority notifications is sent via the Lovable email pipeline (`src/routes/lovable/email/...` + `src/lib/email-templates/`).

---

## 9. SEO

- Per-route `head()` blocks set unique titles/descriptions/OG.
- `src/routes/sitemap[.]xml.ts` generates a sitemap from active listings + campus landing pages.
- `src/routes/sublease.$slug.tsx` is the public campus landing page with structured data; auth-gated discovery routes use a public overlay fallback so crawlers see content.
- `public/robots.txt` allows everything except `/admin`, `/api`, and `/lovable`.

---

## 10. Gotchas (read these before you touch things)

1. **Never edit** `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts` or `src/routeTree.gen.ts`. Auto-generated.
2. **GRANT every new public table.** RLS alone is not enough on Lovable Cloud — Supabase doesn't grant default privileges to `anon/authenticated/service_role` here. See existing migrations for the canonical pattern (`GRANT … TO authenticated; GRANT ALL … TO service_role;`).
3. **No `child_process` / `sharp` / native modules** in any server code. Edge runtime.
4. **No `@/server/...` client imports.** `src/server/` is blocked from client bundles.
5. **Photos are stored in the `listing-photos` Storage bucket as paths**, not URLs. `queries.ts::attachSignedUrls` mints 7-day signed URLs on read.
6. **Featured listing ordering**: feed sorts by `is_featured DESC, created_at DESC`. If you add a new sort, preserve featured-first.
7. **Chat permissions:** `messages` RLS requires a matching `conversations` row that includes both sender + recipient — you can't insert a message without first calling `getOrCreateConversation`.
8. **Onboarding gate:** `routes/index.tsx` redirects authenticated users with `onboarding_completed=false` to `/onboarding`. Don't remove without updating the trigger that sets the default.
9. **Profile `is_admin` escalation is blocked** by the profiles UPDATE policy — only admins can flip it. Tested in security scans.
10. **Stripe webhook idempotency:** Stripe will retry on non-2xx. Handlers must be idempotent (current code uses status checks + unique stripe IDs).
11. **`pg_cron` jobs** drive: `looking_for_posts` 90-day expiry, post-tour survey prompts, `listing_stats_daily` snapshots, stale-listing nudges, saved-search match scans. List them with `SELECT * FROM cron.job;`.
12. **Theme is set pre-hydration** by an inline script in `__root.tsx` to avoid FOUC. Don't remove without replacing.

---

## 11. Local dev

- `bun install` then `bun dev` (template auto-runs in the Lovable sandbox).
- Migrations apply automatically on Lovable Cloud — don't run `supabase db push` manually here.
- `bun run build` is run by CI; `tsgo` is the typechecker we use (faster than `tsc --noEmit`).

---

## 12. Where to start as a reviewer

1. Read this file.
2. Skim `src/lib/leaseup/types.ts` for the domain.
3. Skim `src/lib/leaseup/queries.ts` to see all read/write patterns in one place.
4. Open `src/routes/index.tsx` — that's the home and exercises map + scroll + bottom nav + onboarding gate.
5. Open `src/routes/api/public/stripe-webhook.ts` and `src/lib/leaseup/stripe.functions.ts` for the payment path.
6. Open `supabase/migrations/` newest-to-oldest to understand schema evolution.

Open issues / human-only tasks live in `.notes/`. The product roadmap & rejected ideas live in project memory at `mem://`.
