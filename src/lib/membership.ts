// Client-safe membership metadata for AETHRON access tiers.
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
    name: "Orbit",
    price: 0,
    cadence: "forever",
    tagline: "Get inside the engine and track a few ideas.",
    features: [
      "Multi-asset desks & AETHRON Scores",
      "Portfolio & wallet tracking",
      `${FREE_ALERT_LIMIT} watchlist alerts`,
      "Read the community terminal",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: 20,
    cadence: "per month",
    tagline: "Unlimited alerts, whale flow and a voice in the terminal.",
    badge: "PRO",
    features: [
      "Unlimited real-time alerts",
      "Whale flow & unusual activity feed",
      "Push + in-app notifications",
      "Post in the community terminal",
      "Pro badge on your profile",
    ],
  },
  {
    tier: "elite",
    name: "Elite",
    price: 30,
    cadence: "per month",
    tagline: "Full engine: deep research, backtests and priority signals.",
    badge: "ELITE",
    features: [
      "Everything in Pro",
      "AI deep-research reports",
      "Strategy backtesting workspace",
      "Advanced scanner presets",
      "Elite badge & early access modules",
    ],
  },
];


export const planByTier = (tier: Tier) => plans.find((p) => p.tier === tier) ?? plans[0]!;
export const isPaid = (tier: Tier) => tier === "pro" || tier === "elite";
