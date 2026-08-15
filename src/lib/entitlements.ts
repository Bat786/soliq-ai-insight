// Client-safe entitlement rules: maps billing records to SOLIQ access tiers.
import type { Tier } from "@/lib/membership";

export type Cadence = "monthly" | "yearly";

/** Stripe price ids (human-readable lookup keys) per tier + cadence. */
export const PRICE_IDS: Record<Exclude<Tier, "free">, Record<Cadence, string>> = {
  pro: { monthly: "soliq_pro_monthly", yearly: "soliq_pro_yearly" },
  elite: { monthly: "soliq_professional_monthly", yearly: "soliq_professional_yearly" },
};

/** Yearly list price in USD (billed once per year). */
export const YEARLY_PRICE: Record<Exclude<Tier, "free">, number> = { pro: 192, elite: 288 };

export function priceIdFor(tier: Tier, cadence: Cadence): string | null {
  if (tier === "free") return null;
  return PRICE_IDS[tier][cadence];
}

/** Resolve which tier a price id grants. Keyed off price id, never product id. */
export function tierFromPriceId(priceId: string | null | undefined): Tier {
  if (!priceId) return "free";
  if (priceId.startsWith("soliq_professional")) return "elite";
  if (priceId.startsWith("soliq_pro")) return "pro";
  return "free";
}

export function cadenceFromPriceId(priceId: string | null | undefined): Cadence {
  return priceId?.endsWith("_yearly") ? "yearly" : "monthly";
}

export type SubscriptionRow = {
  price_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id?: string | null;
};

/**
 * Access-granting statuses. `past_due` keeps access while Stripe retries the
 * charge; a `canceled` plan keeps access until the paid period ends.
 */
export function subscriptionGrantsAccess(sub: SubscriptionRow): boolean {
  const endsAt = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const withinPeriod = endsAt === null || endsAt > Date.now();
  if (["active", "trialing", "past_due"].includes(sub.status)) return withinPeriod;
  if (sub.status === "canceled") return endsAt !== null && endsAt > Date.now();
  return false;
}

/** Highest tier granted by any currently valid subscription row. */
export function tierFromSubscriptions(subs: SubscriptionRow[]): Tier {
  let tier: Tier = "free";
  for (const sub of subs) {
    if (!subscriptionGrantsAccess(sub)) continue;
    const next = tierFromPriceId(sub.price_id);
    if (next === "elite") return "elite";
    if (next === "pro") tier = "pro";
  }
  return tier;
}

export const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, elite: 2 };

export function meetsTier(current: Tier, required: Tier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}

/**
 * Gated feature registry — single source of truth for premium surfaces.
 * Pro gets the "tell me something is happening" half; Elite gets everything,
 * including every decision-grade module.
 */
export const FEATURES = {
  unlimitedAlerts: { tier: "pro" as Tier, label: "Unlimited real-time alerts" },
  minuteAlerts: { tier: "pro" as Tier, label: "Minute-resolution alert evaluation" },
  communityPosting: { tier: "pro" as Tier, label: "Posting in the community terminal" },
  whaleFlow: { tier: "pro" as Tier, label: "Whale flow & unusual activity" },
  tradingJournal: { tier: "pro" as Tier, label: "Trading journal" },
  backtesting: { tier: "elite" as Tier, label: "Strategy backtesting workspace" },
  deepResearch: { tier: "elite" as Tier, label: "AI deep-research reports" },
  scannerPresets: { tier: "elite" as Tier, label: "Advanced scanner presets" },
  darkPool: { tier: "elite" as Tier, label: "Dark-pool tape & institutional positioning" },
  aggregatedPortfolio: { tier: "elite" as Tier, label: "Aggregated cross-account portfolio analytics" },
  prioritySignals: { tier: "elite" as Tier, label: "Priority signal delivery" },
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function featureTier(feature: FeatureKey): Tier {
  return FEATURES[feature].tier;
}

export function canUse(feature: FeatureKey, tier: Tier): boolean {
  return meetsTier(tier, featureTier(feature));
}
