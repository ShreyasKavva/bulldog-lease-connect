/**
 * Stripe server functions — the WRITE side of payments. The webhook at
 * src/routes/api/public/stripe-webhook.ts handles asynchronous results.
 *
 * Two flows live here:
 *
 * 1. Featured Listing Boost ($9.99 / 7 days)
 *    createBoostCheckout → Stripe Checkout Session.
 *    On checkout.session.completed the webhook flips listings.is_featured=true,
 *    sets featured_until, and writes boost_purchases.status='paid'.
 *
 * 2. Deposit Escrow
 *    createDepositIntent → Stripe PaymentIntent with capture_method='manual'.
 *    Funds are authorized but held until adminReleaseDeposit (capture) or
 *    adminRefundDeposit (refund). State mirror in deposit_agreements:
 *    pending → held → released | refunded.
 *
 * Authorization: every fn uses requireSupabaseAuth and then verifies
 * ownership (poster) or admin role before talking to Stripe. Do NOT relax
 * these checks — these are real money operations.
 *
 * The Stripe SDK is require()'d lazily inside getStripeServer() so the bundle
 * stays small and so process.env.STRIPE_SECRET_KEY is read at call-time
 * (module-scope reads can be undefined in some bundling paths).
 *
 * Required secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SITE_URL.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SITE_URL = process.env.SITE_URL || "https://leasup.co";
const BOOST_CENTS = 999;

function getStripeServer() {
  // Lazy-load the Stripe SDK so the route bundle doesn't drag it client-side.
  // process.env.STRIPE_SECRET_KEY is read inside the handler per server-fn rules.
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured yet. Please add STRIPE_SECRET_KEY.");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Stripe = require("stripe");
  return new Stripe(key);
}

// ---------- Featured Listing Boost ($9.99 / 7 days) ----------
export const createBoostCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { listingId: string }) => {
    if (!data?.listingId) throw new Error("listingId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify the caller owns this listing.
    const { data: listing, error } = await supabase
      .from("listings")
      .select("id, user_id, title")
      .eq("id", data.listingId)
      .maybeSingle();
    if (error) throw error;
    if (!listing) throw new Error("Listing not found");
    if (listing.user_id !== userId) throw new Error("You can only boost your own listing");

    const stripe = getStripeServer();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "⚡ Featured Listing — 7 days",
              description: `Pin "${listing.title}" to the top of the LeaseUp feed`,
            },
            unit_amount: BOOST_CENTS,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${SITE_URL}/my-listings?boosted=${listing.id}`,
      cancel_url: `${SITE_URL}/my-listings`,
      metadata: {
        type: "boost",
        listing_id: listing.id,
        user_id: userId,
      },
    });

    // Record a pending purchase row scoped to this user (RLS: user must equal auth.uid()).
    await supabase.from("boost_purchases").insert({
      listing_id: listing.id,
      user_id: userId,
      stripe_session_id: session.id,
      amount_cents: BOOST_CENTS,
      status: "pending",
    });

    return { url: session.url as string };
  });

// ---------- Secure Deposit — create PaymentIntent (manual capture) ----------
export const createDepositIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { listingId: string; moveInDate?: string | null }) => {
    if (!data?.listingId) throw new Error("listingId required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: listing, error } = await supabase
      .from("listings")
      .select("id, user_id, deposit_amount, deposit_escrow_enabled, title")
      .eq("id", data.listingId)
      .maybeSingle();
    if (error) throw error;
    if (!listing) throw new Error("Listing not found");
    if (!listing.deposit_escrow_enabled || !listing.deposit_amount) {
      throw new Error("This listing does not offer secure deposit.");
    }
    if (listing.user_id === userId) {
      throw new Error("You cannot pay deposit on your own listing.");
    }

    const depositCents = Math.round(Number(listing.deposit_amount) * 100);
    const feeCents = Math.round(depositCents * 0.025);
    const totalCents = depositCents + feeCents;

    const stripe = getStripeServer();
    const intent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      capture_method: "manual", // hold funds — captured on release
      metadata: {
        type: "deposit",
        listing_id: listing.id,
        poster_id: listing.user_id,
        subletter_id: userId,
      },
      description: `LeaseUp deposit for ${listing.title}`,
    });

    // Insert the pending agreement (RLS: subletter_id must equal auth.uid()).
    const { error: insErr } = await supabase.from("deposit_agreements").insert({
      listing_id: listing.id,
      poster_id: listing.user_id,
      subletter_id: userId,
      deposit_amount_cents: depositCents,
      stripe_payment_intent_id: intent.id,
      move_in_date: data.moveInDate ?? null,
      status: "pending",
      agreed_at: new Date().toISOString(),
    });
    if (insErr) throw insErr;

    return {
      clientSecret: intent.client_secret as string,
      paymentIntentId: intent.id as string,
      depositCents,
      feeCents,
      totalCents,
    };
  });

// ---------- Admin actions ----------
async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.is_admin) throw new Error("Admin only");
}

export const adminReleaseDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { agreementId: string }) => data)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: agr, error } = await supabaseAdmin
      .from("deposit_agreements")
      .select("id, stripe_payment_intent_id, status, deposit_amount_cents")
      .eq("id", data.agreementId)
      .maybeSingle();
    if (error) throw error;
    if (!agr) throw new Error("Agreement not found");
    if (!agr.stripe_payment_intent_id) throw new Error("No PaymentIntent on file");
    if (!["paid", "held"].includes(agr.status)) throw new Error(`Cannot release from status: ${agr.status}`);

    const stripe = getStripeServer();
    await stripe.paymentIntents.capture(agr.stripe_payment_intent_id);
    await supabaseAdmin
      .from("deposit_agreements")
      .update({ status: "released", released_at: new Date().toISOString() })
      .eq("id", agr.id);
    return { ok: true };
  });

export const adminRefundDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { agreementId: string }) => data)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: agr, error } = await supabaseAdmin
      .from("deposit_agreements")
      .select("id, stripe_payment_intent_id, status")
      .eq("id", data.agreementId)
      .maybeSingle();
    if (error) throw error;
    if (!agr) throw new Error("Agreement not found");
    if (!agr.stripe_payment_intent_id) throw new Error("No PaymentIntent on file");

    const stripe = getStripeServer();
    // If still held (not captured), cancel the intent. If captured, refund.
    try {
      if (agr.status === "released") {
        await stripe.refunds.create({ payment_intent: agr.stripe_payment_intent_id });
      } else {
        await stripe.paymentIntents.cancel(agr.stripe_payment_intent_id);
      }
    } catch (e) {
      // If cancel fails because already captured, fall back to refund.
      await stripe.refunds.create({ payment_intent: agr.stripe_payment_intent_id });
    }
    await supabaseAdmin
      .from("deposit_agreements")
      .update({ status: "refunded", refunded_at: new Date().toISOString() })
      .eq("id", agr.id);
    return { ok: true };
  });
