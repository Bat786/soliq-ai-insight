import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Declared locally so this client module has no cross-tree imports.
type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

/** Derive the environment from the token PREFIX. Never silently default to live. */
function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  throw new Error(
    "Payments are not configured for this build. Complete payment go-live in your Lovable project to enable production checkout.",
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}

/** True when a payments client token is present and recognised. */
export function paymentsConfigured(): boolean {
  return !!clientToken && (clientToken.startsWith("pk_test_") || clientToken.startsWith("pk_live_"));
}
