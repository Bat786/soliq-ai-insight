// Client-safe membership metadata for SOLIQ access tiers.
export type Tier = "free" | "pro" | "elite";

export type Plan = {
  tier: Tier;
  name: string;
  price: number;
  cadence: string;
  tagline: string;
  /** Long-form positioning copy for the pricing and billing surfaces. */
  description: string;
  /** The one line that should make a visitor feel the cost of staying put. */
  fomo: string;
  /** Everything included, written as an outcome the member gets. */
  features: string[];
  /** What this tier does NOT get — rendered struck through to create pull. */
  missing?: string[];
  badge?: string;
};

export const FREE_ALERT_LIMIT = 3;

export const plans: Plan[] = [
  {
    tier: "free",
    name: "Orbit",
    price: 0,
    cadence: "forever",
    tagline: "See the market move. Watch other people trade it.",
    description:
      "Orbit is the window seat. You get the multi-asset desks, SOLIQ Scores and delayed price structure across stocks, crypto, FX, metals and futures — enough to understand what happened, never enough to be early. Every scan runs on the shared queue, every alert is capped, and the flow that actually front-runs price stays locked.",
    fomo: "By the time an Orbit chart confirms a breakout, Pro members were alerted on the minute candle that started it.",
    features: [
      "Multi-asset desks: stocks, crypto, FX, metals, futures",
      "SOLIQ Score on any symbol you search",
      "Portfolio + wallet tracking (Solana & EVM)",
      `${FREE_ALERT_LIMIT} watchlist alerts (evaluated on the slow lane)`,
      "Read-only community terminal",
      "Basic AI assistant Q&A",
    ],
    missing: [
      "Minute-resolution alerts",
      "Whale & unusual options flow",
      "Backtesting workspace",
      "AI deep-research reports",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: 20,
    cadence: "per month",
    tagline: "Get told first. Every minute, on every symbol you own.",
    badge: "PRO",
    description:
      "Pro turns the engine on: unlimited alerts evaluated on live minute bars, real-time whale and unusual-options flow, push notifications that reach your phone before the move shows up on Twitter, and a voice in the community terminal. It is roughly half of the AETHRON stack — the half that tells you something is happening. Elite is the half that tells you what to do about it.",
    fomo: "One missed 3% gap on a position you already hold costs more than a year of Pro.",
    features: [
      "Unlimited real-time alerts on minute bars",
      "Push + in-app notifications, 24/7 across all markets",
      "Whale flow & unusual options activity feed",
      "Live intraday scanner (1m → 4h) across the full stock, ETF & crypto universe",
      "Post, reply and build a following in the community terminal",
      "Full symbol intelligence dashboards + technical indicator stack",
      "Trading journal with tagged entries",
      "Pro badge on your profile",
      "Priority data lane — faster refresh than Orbit",
    ],
    missing: [
      "Strategy backtesting workspace",
      "AI deep-research reports",
      "Advanced scanner presets & dark-pool tape",
      "Elite priority signals",
    ],
  },
  {
    tier: "elite",
    name: "Elite",
    price: 30,
    cadence: "per month",
    tagline: "The full engine. Nothing held back, nothing behind another paywall.",
    badge: "ELITE",
    description:
      "Elite unlocks every gate in SOLIQ: the backtesting workspace where you prove a strategy across 1-minute to 1-year data on stocks, futures and crypto before risking a dollar; AI deep-research reports that read filings, flow and on-chain movement into one thesis; advanced scanner presets that hunt setups while you sleep; the dark-pool and institutional tape; and cross-account aggregated portfolio analytics. Ten dollars more than Pro, and it is the ten dollars that changes decisions.",
    fomo: "Everyone can see the same candle. Elite members are the only ones who can prove what happens next — and they only pay $10 more than the people guessing.",
    features: [
      "Everything in Pro, unlimited",
      "Strategy backtesting workspace — 1m to 1Y, stocks + futures + crypto",
      "Backtest analytics: win rate, expectancy, drawdown, key insights",
      "AI deep-research reports (filings + flow + on-chain in one thesis)",
      "Advanced scanner presets & saved multi-factor screens",
      "Dark-pool tape, sector heat maps & institutional positioning",
      "Whale wallet tracking with cross-chain P&L attribution",
      "Aggregated portfolio analytics across wallets & brokerages",
      "Priority signal delivery — Elite alerts fire first",
      "Elite badge, early access to every new module",
    ],
  },
];

export const planByTier = (tier: Tier) => plans.find((p) => p.tier === tier) ?? plans[0]!;
export const isPaid = (tier: Tier) => tier === "pro" || tier === "elite";
