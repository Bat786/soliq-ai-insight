import type { StripeEnv } from "@/lib/stripe.server";
import { tierFromPriceId } from "@/lib/entitlements";

type StripeSubscriptionLike = {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean;
  current_period_start?: number;
  current_period_end?: number;
  metadata?: Record<string, string> | null;
  items?: {
    data: Array<{
      current_period_start?: number;
      current_period_end?: number;
      price?: {
        id: string;
        lookup_key?: string | null;
        metadata?: Record<string, string> | null;
        product?: string | { id: string };
      };
    }>;
  };
};

const iso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);

/** Fields we mirror from a Stripe subscription into public.subscriptions. */
export function mapSubscription(sub: StripeSubscriptionLike, env: StripeEnv, userId: string) {
  const item = sub.items?.data?.[0];
  // Prefer lookup_key: stable across sandbox and live. Never key tiers off product id.
  const priceId =
    item?.price?.lookup_key ||
    item?.price?.metadata?.["lovable_external_id"] ||
    item?.price?.id ||
    "";
  const product = item?.price?.product;
  const productId = typeof product === "string" ? product : (product?.id ?? "");
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  return {
    user_id: userId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    product_id: productId,
    price_id: priceId,
    status: sub.status,
    current_period_start: iso(periodStart),
    current_period_end: iso(periodEnd),
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    environment: env,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Write the subscription record and keep the profile's cached membership tier
 * (and renewal date) in sync, so UI reads stay a single cheap query.
 */
export async function upsertSubscriptionRecord(
  sub: StripeSubscriptionLike,
  env: StripeEnv,
  userIdOverride?: string,
) {
  const userId = userIdOverride ?? sub.metadata?.["userId"];
  if (!userId) {
    console.error("Subscription without userId metadata:", sub.id);
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const record = mapSubscription(sub, env, userId);

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(record, { onConflict: "stripe_subscription_id" });
  if (error) console.error("subscriptions upsert failed:", error.message);

  await syncProfileTier(userId);
}

/** Recompute the cached tier on the profile from the member's billing records. */
export async function syncProfileTier(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows } = await supabaseAdmin
    .from("subscriptions")
    .select("price_id, status, current_period_end, cancel_at_period_end, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const now = Date.now();
  let tier: "free" | "pro" | "elite" = "free";
  let renewsAt: string | null = null;
  let memberSince: string | null = null;

  for (const row of rows ?? []) {
    const endsAt = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
    const withinPeriod = endsAt === null || endsAt > now;
    const grants =
      (["active", "trialing", "past_due"].includes(row.status) && withinPeriod) ||
      (row.status === "canceled" && endsAt !== null && endsAt > now);
    if (!grants) continue;

    const rowTier = tierFromPriceId(row.price_id);
    if (rowTier === "elite" || (rowTier === "pro" && tier === "free")) {
      if (rowTier === "elite" || tier === "free") {
        tier = rowTier;
        renewsAt = row.current_period_end;
        memberSince = row.created_at;
      }
    }
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      membership_tier: tier,
      renews_at: renewsAt,
      member_since: tier === "free" ? null : memberSince,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) console.error("profile tier sync failed:", error.message);
}

/** Mark a subscription cancelled (access still honoured until period end). */
export async function markSubscriptionCanceled(sub: StripeSubscriptionLike, env: StripeEnv) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env)
    .select("user_id");

  const userId = rows?.[0]?.user_id ?? sub.metadata?.["userId"];
  if (userId) await syncProfileTier(userId);
}
