# Queue 17 — Stripe Go-Live — Action items for you (Joel)

The code is shipped end-to-end. Two things only YOU can do before real money flows.
Everything else (UI, server functions, webhook handler, admin tabs, DB) is live.

---

## 1) Add Stripe secrets in Lovable Cloud → Settings → Secrets

| Secret | Where to get it | Used by |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | https://dashboard.stripe.com/apikeys → "Secret key" (use **Test** mode first, then **Live**) | `src/lib/leaseup/stripe.functions.ts`, webhook |
| `STRIPE_WEBHOOK_SECRET` | https://dashboard.stripe.com/webhooks → after creating the endpoint (step 2) → "Signing secret" `whsec_…` | `src/routes/api/public/stripe-webhook.ts` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | https://dashboard.stripe.com/apikeys → "Publishable key" `pk_…` | Client (`src/lib/leaseup/stripe-client.ts`) — required for embedded deposit payment form |
| `SITE_URL` (optional) | `https://leasup.co` | Boost checkout success/cancel URLs (defaults to `https://leasup.co` if unset) |

Until these are set:
- The Boost button shows a friendly "Stripe not configured" toast.
- The Secure Deposit payment step refuses to open and toasts "Secure deposits aren't enabled yet."
- Webhook returns `503 Stripe not configured` (safe; ignored by Stripe retry queue).

---

## 2) Register the Stripe webhook

In https://dashboard.stripe.com/webhooks → **Add endpoint**:

- **Endpoint URL**: `https://leasup.co/api/public/stripe-webhook`
- **Events to send**:
  - `checkout.session.completed`        ← flips `is_featured = true` after a Boost
  - `payment_intent.succeeded`          ← marks deposit as `held`/`released`
  - `payment_intent.amount_capturable_updated` ← also marks deposit as `held` when authorized
  - `payment_intent.payment_failed`     ← rolls deposit back to `pending`
  - `charge.refunded`                   ← marks deposit/boost as `refunded`

Then copy the **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` (step 1).

Run a test event from the dashboard ("Send test webhook") — should return `200 { "received": true }`.

---

## 3) Activate live mode (after testing)

1. Toggle the Stripe dashboard from **Test** → **Live**.
2. Swap `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` to the live-mode values.
3. Re-register the webhook on the live dashboard (live-mode webhooks are separate).

---

## What's already shipped (code-side, no action needed)

- DB: `boost_purchases`, `deposit_agreements`, `listings.is_featured / featured_until / deposit_amount / deposit_escrow_enabled`, hourly pg_cron job to un-feature expired listings.
- Server fns: `createBoostCheckout`, `createDepositIntent`, `adminReleaseDeposit`, `adminRefundDeposit` in `src/lib/leaseup/stripe.functions.ts`.
- Webhook: `src/routes/api/public/stripe-webhook.ts` (signature-verified, idempotent on session/intent IDs).
- UI: `BoostCard` per listing in `/my-listings` (with celebration toast on `?boosted=…` return), `SecureDepositDialog` 3-step flow embedded into `ListingDetailSheet` for non-owners, deposit toggle in `PostListingDialog`.
- Badges: `⭐ Featured` orange pill + gold ring + 🔒 `Secure Deposit` green pill on `ListingCard`.
- Sort order: `fetchListings()` orders by `is_featured DESC, created_at DESC` so featured listings pin to the top of the scroll feed, browse grid, and map clusters.
- Admin: new **Revenue** tab (all-time + this-month boost revenue, projected MRR, fees, deposit totals + per-row tables) and **Deposits** tab (Release / Refund buttons wired to Stripe capture/cancel/refund).
- Notifications: poster gets in-app pings on `boost_active` and `deposit_held`.
