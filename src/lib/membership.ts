// Client-safe membership metadata for SOLIQ premium plans.
export type Tier = "free" | "pro" | "elite";

export type Plan = {
  tier: Tier;
  name: string;
  price: number;
  cadence: string;
  tagline: string;
  features: string[];
  badge?: string;
};

export const FREE_ALERT_LIMIT = 3;

export const plans: Plan[] = [
  {
    tier: "free",
    name: "Explorer",
    price: 0,
    cadence: "forever",
    tagline: "Scan the market and track a few ideas.",
    features: [
      "Market scanner & SOLIQ Scores",
      "Portfolio tracking",
      `${FREE_ALERT_LIMIT} watchlist alerts`,
      "Read the community feed",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: 19,
    cadence: "per month",
    tagline: "Unlimited alerts and a voice in the community.",
    badge: "PRO",
    features: [
      "Unlimited watchlist alerts",
      "Real-time in-app notifications",
      "Post in the community feed",
      "Pro badge on your profile",
      "Priority AI assistant queue",
    ],
  },
  {
    tier: "elite",
    name: "Elite",
    price: 49,
    cadence: "per month",
    tagline: "Deep research and institutional-grade signals.",
    badge: "ELITE",
    features: [
      "Everything in Pro",
      "AI deep-research reports",
      "Advanced scanner presets",
      "Elite badge on your profile",
      "Early access to new modules",
    ],
  },
];

export const planByTier = (tier: Tier) => plans.find((p) => p.tier === tier) ?? plans[0]!;
export const isPaid = (tier: Tier) => tier === "pro" || tier === "elite";
