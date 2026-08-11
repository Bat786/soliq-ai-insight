// Deterministic mock market data for SOLIQ.
// Replace with live market APIs + Lovable Cloud tables later.

export type Category = "crypto" | "memecoin" | "defi" | "nft";

export type Asset = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
  cap: "micro" | "small" | "mid" | "large";
  category: Category;
  score: number;
  risk: number;
  rsi: number;
  trend: "up" | "down" | "flat";
  reason: string;
  series: number[];
};

function seededSeries(seed: number, drift: number, points = 32): number[] {
  let s = seed;
  const out: number[] = [];
  let v = 100;
  for (let i = 0; i < points; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const noise = (s / 2147483648 - 0.5) * 6;
    v = v + noise + drift;
    out.push(Number(v.toFixed(2)));
  }
  return out;
}

type Seed = [
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  Asset["cap"],
  Category,
  number,
  number,
  number,
  string,
];

const seeds: Seed[] = [
  ["btc", "Bitcoin", 104820.44, 2.9, 7.4, 2070e9, 48.2e9, "large", "crypto", 91, 18, 63, "Volume expansion with sustained spot bid"],
  ["sol", "Solana", 238.17, 6.4, 14.2, 118e9, 7.9e9, "large", "crypto", 94, 26, 68, "Bullish accumulation + rising network fees"],
  ["eth", "Ethereum", 3894.2, 1.8, 4.1, 469e9, 21.4e9, "large", "crypto", 86, 21, 58, "Breakout retest holding above range high"],
  ["jup", "Jupiter", 1.34, 9.7, 22.8, 4.1e9, 640e6, "mid", "defi", 88, 38, 71, "Liquidity growth and fee revenue acceleration"],
  ["wif", "dogwifhat", 2.41, 18.2, 41.6, 2.4e9, 1.1e9, "small", "memecoin", 79, 72, 78, "Social momentum spike, elevated volatility"],
  ["jto", "Jito", 3.12, -4.3, -8.9, 1.1e9, 210e6, "small", "defi", 64, 44, 41, "Momentum cooling below 50-day average"],
  ["pyth", "Pyth Network", 0.512, 5.1, 11.3, 1.9e9, 180e6, "small", "defi", 81, 35, 62, "Higher lows with improving oracle usage"],
  ["bonk", "Bonk", 0.0000342, -9.8, -17.4, 780e6, 320e6, "micro", "memecoin", 51, 84, 33, "Distribution pattern, thinning liquidity"],
  ["ray", "Raydium", 5.87, 3.6, 6.2, 1.5e9, 240e6, "small", "defi", 76, 40, 57, "Volume profile shifting to higher value area"],
  ["tnsr", "Tensor", 0.68, 12.4, 19.1, 190e6, 44e6, "micro", "nft", 72, 66, 74, "NFT volume rebound, breakout on high volume"],
  ["mplx", "Metaplex", 0.31, -2.1, 3.4, 240e6, 18e6, "micro", "nft", 58, 58, 47, "Range-bound, awaiting volume confirmation"],
  ["kmno", "Kamino", 1.02, 7.8, 15.9, 620e6, 96e6, "micro", "defi", 83, 42, 66, "TVL expansion with improving sentiment"],
  ["pepe", "Pepe", 0.0000201, 14.7, 27.3, 8.4e9, 2.2e9, "mid", "memecoin", 69, 78, 76, "Crowded momentum trade, high reflexivity"],
  ["ondo", "Ondo", 1.88, 4.2, 9.8, 2.7e9, 310e6, "mid", "defi", 85, 30, 60, "RWA inflows steady, structure constructive"],
];

export const assets: Asset[] = seeds.map(
  ([id, name, price, c24, c7, mc, vol, cap, category, score, risk, rsi, reason], i) => ({
    id,
    symbol: id.toUpperCase(),
    name,
    price,
    change24h: c24,
    change7d: c7,
    marketCap: mc,
    volume24h: vol,
    cap,
    category,
    score,
    risk,
    rsi,
    trend: c24 > 1 ? "up" : c24 < -1 ? "down" : "flat",
    reason,
    series: seededSeries(i * 7717 + 13, c24 / 8),
  }),
);

export const byId = (id: string) => assets.find((a) => a.id === id);

export const gainers = [...assets].sort((a, b) => b.change24h - a.change24h).slice(0, 5);
export const losers = [...assets].sort((a, b) => a.change24h - b.change24h).slice(0, 5);
export const trending = [assets[1], assets[4], assets[3], assets[12], assets[9]].filter(Boolean) as Asset[];
export const aiPicks = [...assets].sort((a, b) => b.score - a.score).slice(0, 4);

export const marketStats = [
  { label: "Total Market Cap", value: "$3.42T", delta: 2.4 },
  { label: "24h Volume", value: "$148.6B", delta: 11.8 },
  { label: "BTC Dominance", value: "54.8%", delta: -0.6 },
  { label: "Fear & Greed", value: "72 · Greed", delta: 6.0 },
];

export const watchlists = [
  { id: "solana-gems", name: "Solana Gems", assetIds: ["sol", "jup", "jto", "kmno"], perf: 12.4, alerts: 3 },
  { id: "ai-crypto", name: "AI Crypto", assetIds: ["pyth", "ondo", "ray"], perf: 5.8, alerts: 1 },
  { id: "memecoin-watch", name: "Memecoin Watch", assetIds: ["wif", "bonk", "pepe"], perf: -4.2, alerts: 5 },
  { id: "long-term", name: "Long Term Holdings", assetIds: ["btc", "eth", "sol"], perf: 8.9, alerts: 0 },
  { id: "trading-setups", name: "Trading Setups", assetIds: ["tnsr", "jup", "ray", "wif"], perf: 19.6, alerts: 2 },
];

export const holdings = [
  { id: "sol", qty: 142.5, costBasis: 168.2 },
  { id: "btc", qty: 0.62, costBasis: 82100 },
  { id: "jup", qty: 8200, costBasis: 0.98 },
  { id: "wif", qty: 1450, costBasis: 1.82 },
  { id: "bonk", qty: 24000000, costBasis: 0.0000391 },
];

export const portfolio = holdings.map((h) => {
  const a = byId(h.id)!;
  const value = h.qty * a.price;
  const cost = h.qty * h.costBasis;
  return { ...h, asset: a, value, cost, pnl: value - cost, pnlPct: ((value - cost) / cost) * 100 };
});

export const portfolioValue = portfolio.reduce((s, p) => s + p.value, 0);
export const portfolioCost = portfolio.reduce((s, p) => s + p.cost, 0);
export const portfolioSeries = seededSeries(4242, 1.4, 40);

export const news = [
  {
    title: "Spot Solana ETF sees record weekly inflows",
    source: "SOLIQ Wire",
    time: "18m ago",
    tag: "Flows",
  },
  { title: "Bitcoin open interest hits 3-month high", source: "Derivatives Desk", time: "1h ago", tag: "Derivatives" },
  { title: "DeFi TVL crosses $180B as lending demand returns", source: "On-chain", time: "3h ago", tag: "DeFi" },
  { title: "Memecoin volumes cool after parabolic week", source: "Market Pulse", time: "5h ago", tag: "Memes" },
];

export const predictions = [
  { q: "Will SOL reach $300 before December?", yes: 61, volume: "$1.4M", closes: "Dec 1" },
  { q: "Will BTC close the year above $120K?", yes: 44, volume: "$8.2M", closes: "Dec 31" },
  { q: "Will the Fed cut rates at the next meeting?", yes: 72, volume: "$3.1M", closes: "Sep 18" },
  { q: "Will ETH/BTC reclaim 0.045?", yes: 29, volume: "$620K", closes: "Oct 15" },
];

export const communityPosts = [
  {
    id: "1",
    author: "Nadia Kovač",
    handle: "@onchainnadia",
    role: "Top Analyst",
    rep: 9840,
    time: "12m",
    body: "SOL funding reset while spot volume kept expanding — that's the healthiest kind of continuation setup. Watching 232 as invalidation.",
    likes: 214,
    comments: 38,
    tags: ["SOL", "Momentum"],
  },
  {
    id: "2",
    author: "Marcus Reyes",
    handle: "@mreyes",
    role: "Top Trader",
    rep: 8120,
    time: "48m",
    body: "Took partials on WIF into the 18% pop. Risk score is 72 for a reason — position size is the whole trade here.",
    likes: 167,
    comments: 24,
    tags: ["WIF", "Risk"],
  },
  {
    id: "3",
    author: "Ines Duarte",
    handle: "@ines_research",
    role: "Top Researcher",
    rep: 7460,
    time: "2h",
    body: "Full research note on RWA yield curves is up. ONDO fee capture is compounding faster than issuance — worth a read before you fade it.",
    likes: 302,
    comments: 51,
    tags: ["ONDO", "Research"],
  },
];

export const leaderboard = [
  { name: "Nadia Kovač", handle: "@onchainnadia", cat: "Top Analyst", score: 9840, win: 74 },
  { name: "Marcus Reyes", handle: "@mreyes", cat: "Top Trader", score: 8120, win: 68 },
  { name: "Ines Duarte", handle: "@ines_research", cat: "Top Researcher", score: 7460, win: 71 },
  { name: "Kwame Osei", handle: "@kwame", cat: "Top Trader", score: 6980, win: 64 },
  { name: "Lena Fischer", handle: "@lenaf", cat: "Top Analyst", score: 6410, win: 66 },
];

export const education = [
  { title: "Investing 101: Building your first thesis", level: "Beginner", mins: 8 },
  { title: "Reading volume profile like a desk trader", level: "Intermediate", mins: 12 },
  { title: "RSI, MACD and when indicators lie", level: "Intermediate", mins: 10 },
  { title: "Position sizing for high-volatility assets", level: "Advanced", mins: 14 },
];

export const newProjects = [
  { name: "Helix Protocol", symbol: "HLX", age: "3d", fdv: "$42M", score: 77 },
  { name: "Solstice Finance", symbol: "SOLS", age: "6d", fdv: "$18M", score: 71 },
  { name: "Nebula AI", symbol: "NEBA", age: "9d", fdv: "$88M", score: 82 },
  { name: "Driftwood", symbol: "DRFT", age: "12d", fdv: "$9M", score: 63 },
];

export const fmtUsd = (n: number) => {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
};

export const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
