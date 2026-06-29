/**
 * STRIPE WEBHOOK (PUBLIC). The async side of every payment flow.
 *
 * Lives under /api/public/* so it bypasses our auth gate on the published
 * site — the security model is the Stripe signature check below. If that
 * verification is removed or weakened, anyone on the internet could mark
 * listings as featured or escrow deposits as released. Don't.
 *
 * Idempotency: Stripe retries on any non-2xx response. Every handler is
 * written so a re-delivery of the same event is a no-op (we update by
 * stripe_session_id / stripe_payment_intent_id, never blindly insert).
 *
 * Event → effect map:
 *   checkout.session.completed (metadata.type=boost)
 *     → listings.is_featured=true, featured_until=now+7d, notification
 *   payment_intent.amount_capturable_updated (metadata.type=deposit)
 *     → deposit_agreements.status='held' (funds authorized, awaiting capture)
 *   payment_intent.succeeded (metadata.type=deposit, fully captured)
 *     → deposit_agreements.status='released'
 *   payment_intent.payment_failed
 *     → deposit_agreements.status='pending' (reset for retry)
 *   charge.refunded
 *     → deposit_agreements.status='refunded' OR boost_purchases.status='refunded'
 *
 * supabaseAdmin is dynamic-imported INSIDE the handler. Top-level imports of
 * *.server.ts from a route file leak the service-role client into the
 * client-bundle graph — see ENGINEER_NOTES.md §5.
 *
 * Required env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
 */
import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhook (public, signature-verified).
 *
 * Register at https://dashboard.stripe.com/webhooks pointed at
 *   https://leasup.co/api/public/stripe-webhook
 * with the events:
 *   - checkout.session.completed
 *   - payment_intent.succeeded
 *   - payment_intent.payment_failed
 *   - charge.refunded
 *
 * Required secrets:
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_WEBHOOK_SECRET
 */
export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secretKey || !webhookSecret) {
          return new Response("Stripe not configured", { status: 503 });
        }

        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });

        const rawBody = await request.text();

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Stripe = require("stripe");
        const stripe = new Stripe(secretKey);

        let event: any;
        try {
          event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        } catch (err: any) {
          return new Response(`Bad signature: ${err.message}`, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object;
              if (session.metadata?.type === "boost") {
                const listingId = session.metadata.listing_id as string;
                const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                await supabaseAdmin
                  .from("listings")
                  .update({
                    is_featured: true,
                    featured_until: until,
                    featured_purchased_at: new Date().toISOString(),
                  })
                  .eq("id", listingId);
                await supabaseAdmin
                  .from("boost_purchases")
                  .update({
                    status: "paid",
                    stripe_payment_intent_id: session.payment_intent ?? null,
                    paid_at: new Date().toISOString(),
                  })
                  .eq("stripe_session_id", session.id);
                // Notify the poster
                if (session.metadata.user_id) {
                  await supabaseAdmin.from("notifications").insert({
                    user_id: session.metadata.user_id,
                    type: "boost_active",
                    title: "🎉 Your listing is featured for 7 days",
                    body: "It will appear at the top of the feed with a ⭐ Featured badge.",
                    link: `/my-listings`,
                    data: { listing_id: listingId },
                  });
                }
              }
              break;
            }

            case "payment_intent.succeeded": {
              const intent = event.data.object;
              if (intent.metadata?.type === "deposit") {
                // capture_method=manual → "succeeded" here means funds authorized + held
                const isCaptured = intent.amount_received >= intent.amount;
                await supabaseAdmin
                  .from("deposit_agreements")
                  .update({
                    status: isCaptured ? "released" : "held",
                    paid_at: new Date().toISOString(),
                  })
                  .eq("stripe_payment_intent_id", intent.id);
                if (intent.metadata.poster_id && !isCaptured) {
                  await supabaseAdmin.from("notifications").insert({
                    user_id: intent.metadata.poster_id,
                    type: "deposit_held",
                    title: "🔒 Deposit held securely",
                    body: "Your subletter paid the deposit through LeaseUp. Funds release at move-in.",
                    link: `/my-listings`,
                    data: { listing_id: intent.metadata.listing_id, intent_id: intent.id },
                  });
                }
              }
              break;
            }

            case "payment_intent.amount_capturable_updated": {
              const intent = event.data.object;
              if (intent.metadata?.type === "deposit") {
                await supabaseAdmin
                  .from("deposit_agreements")
                  .update({ status: "held", paid_at: new Date().toISOString() })
                  .eq("stripe_payment_intent_id", intent.id);
              }
              break;
            }

            case "payment_intent.payment_failed": {
              const intent = event.data.object;
              if (intent.metadata?.type === "deposit") {
                await supabaseAdmin
                  .from("deposit_agreements")
                  .update({ status: "pending" })
                  .eq("stripe_payment_intent_id", intent.id);
              }
              break;
            }

            case "charge.refunded": {
              const charge = event.data.object;
              if (charge.payment_intent) {
                await supabaseAdmin
                  .from("deposit_agreements")
                  .update({ status: "refunded", refunded_at: new Date().toISOString() })
                  .eq("stripe_payment_intent_id", charge.payment_intent);
                await supabaseAdmin
                  .from("boost_purchases")
                  .update({ status: "refunded" })
                  .eq("stripe_payment_intent_id", charge.payment_intent);
              }
              break;
            }
          }
        } catch (e: any) {
          console.error("[stripe-webhook] handler error", event.type, e);
          return new Response(`handler error: ${e.message}`, { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
