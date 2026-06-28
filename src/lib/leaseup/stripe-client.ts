import { loadStripe, type Stripe } from "@stripe/stripe-js";

let _stripe: Promise<Stripe | null> | null = null;

/**
 * Lazy Stripe.js loader. Reads VITE_STRIPE_PUBLISHABLE_KEY at call-time.
 * Returns null if the key is not configured yet so callers can show a friendly
 * "payments not configured" message instead of crashing.
 */
export function getStripe(): Promise<Stripe | null> {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
  if (!key) {
    if (typeof console !== "undefined") {
      console.warn("[stripe] VITE_STRIPE_PUBLISHABLE_KEY is not set — payments disabled");
    }
    return Promise.resolve(null);
  }
  if (!_stripe) _stripe = loadStripe(key);
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
}
