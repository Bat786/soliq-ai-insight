import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { resolveOrCreateCustomer } from "@/lib/payments.helpers";

const envSchema = z.enum(["sandbox", "live"]);

export type CheckoutSessionResult = { clientSecret: string } | { error: string };
export type PortalSessionResult = { url: string } | { error: string };

/** Start an embedded checkout for a SOLIQ membership price. */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { priceId: string; returnUrl: string; environment: StripeEnv }) =>
    z
      .object({
        priceId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
        returnUrl: z.string().url(),
        environment: envSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    const { userId, claims } = context;
    const email = typeof claims["email"] === "string" ? claims["email"] : undefined;

    try {
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0]!;
      const isRecurring = stripePrice.type === "recurring";

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        managed_payments: { enabled: true },
        metadata: { userId },
        ...(isRecurring && { subscription_data: { metadata: { userId } } }),
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Open the hosted billing portal so members can cancel or update their card. */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { returnUrl?: string; environment: StripeEnv }) =>
    z.object({ returnUrl: z.string().url().optional(), environment: envSchema }).parse(input),
  )
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    const { supabase, userId } = context;

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !sub?.stripe_customer_id) {
      return { error: "No billing account found for this member yet." };
    }

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Billing records for the signed-in member (RLS scoped). */
export const getMyBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { environment: StripeEnv }) => z.object({ environment: envSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("subscriptions")
      .select(
        "id, price_id, product_id, status, current_period_start, current_period_end, cancel_at_period_end, stripe_customer_id, created_at",
      )
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/**
 * Reconcile membership straight after checkout returns, so access unlocks even
 * if the webhook is still in flight. Reads the session from Stripe (trusted)
 * and mirrors it into the subscriptions table for the calling member only.
 */
export const syncCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string; environment: StripeEnv }) =>
    z
      .object({ sessionId: z.string().regex(/^[a-zA-Z0-9_-]+$/), environment: envSchema })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["subscription", "subscription.items.data.price"],
      });

      if (session.metadata?.["userId"] !== userId) {
        return { ok: false as const, reason: "This checkout belongs to another account." };
      }
      const subscription = session.subscription;
      if (!subscription || typeof subscription === "string") {
        return { ok: false as const, reason: "Payment is still processing." };
      }

      const { upsertSubscriptionRecord } = await import("@/lib/subscriptions.server");
      await upsertSubscriptionRecord(subscription as any, data.environment, userId);
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, reason: getStripeErrorMessage(error) };
    }
  });
