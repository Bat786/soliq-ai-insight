// Shared, client-safe types for AETHRON's live market layer.

export type Sector = "layer1" | "layer2" | "defi" | "memecoin" | "ai" | "gaming" | "rwa" | "stablecoin" | "other";

export type CapBucket = "nano" | "micro" | "small" | "mid" | "large";

export type Indicators = {
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  ema20: number;
  ema50: number;
  sma50: number;
  vwap: number;
  bbUpper: number;
  bbLower: number;
  bbWidth: number;
  atr: number;
  adx: number;
  momentum: number;
  volatility: number;
  support: number;
  resistance: number;
  trendStrength: number;
};

export type Signals = {
  breakout: boolean;
  breakdown: boolean;
  gapUp: boolean;
  gapDown: boolean;
  highOfDay: boolean;
  lowOfDay: boolean;
  nearHigh52: boolean;
  nearLow52: boolean;
  goldenCross: boolean;
  deathCross: boolean;
  oversold: boolean;
  overbought: boolean;
};

export type OnChain = {
  liquidity: number;
  liquidityChange: number;
  holders: number;
  holderGrowth: number;
  whaleAccumulation: number;
  whaleSelling: number;
  smartMoney: number;
  topWalletConcentration: number;
  exchangeInflow: number;
  exchangeOutflow: number;
  dexVolume: number;
  cexVolume: number;
  largeTransfers: number;
  devActivity: number;
};

export type Sentiment = {
  news: number;
  social: number;
  x: number;
  reddit: number;
  telegram: number;
  fearGreed: number;
};

export type LiveAsset = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  rank: number;
  price: number;
  marketCap: number;
  fdv: number;
  volume24h: number;
  relVolume: number;
  high24h: number;
  low24h: number;
  ath: number;
  athChange: number;
  change1h: number;
  change24h: number;
  change7d: number;
  change30d: number;
  cap: CapBucket;
  sector: Sector;
  series: number[];
  indicators: Indicators;
  signals: Signals;
  onchain: OnChain;
  sentiment: Sentiment;
  bullScore: number;
  bearScore: number;
  neutralScore: number;
  riskScore: number;
  aiScore: number;
  aiConfidence: number;
  buyPressure: number;
  sellPressure: number;
  stance: "bullish" | "bearish" | "neutral";
  thesis: string;
  modelled: string[];
};

export type SortKey =
  | "aiScore"
  | "marketCap"
  | "volume24h"
  | "relVolume"
  | "change24h"
  | "change7d"
  | "rsi"
  | "riskScore"
  | "social";

export type ScanFilters = {
  query: string;
  sectors: Sector[];
  caps: CapBucket[];
  minPrice: number | null;
  maxPrice: number | null;
  minMarketCap: number | null;
  maxMarketCap: number | null;
  minVolume: number | null;
  minRelVolume: number | null;
  minLiquidity: number | null;
  minHolderGrowth: number | null;
  minWhaleAccumulation: number | null;
  minSmartMoney: number | null;
  maxConcentration: number | null;
  minChange1h: number | null;
  minChange24h: number | null;
  maxChange24h: number | null;
  minChange7d: number | null;
  rsiMin: number | null;
  rsiMax: number | null;
  minAdx: number | null;
  minAiScore: number | null;
  minConfidence: number | null;
  maxRisk: number | null;
  minSocial: number | null;
  minNews: number | null;
  minBuyPressure: number | null;
  requireSignals: (keyof Signals)[];
  logic: "and" | "or";
  sort: SortKey;
  desc: boolean;
};

export const emptyFilters: ScanFilters = {
  query: "",
  sectors: [],
  caps: [],
  minPrice: null,
  maxPrice: null,
  minMarketCap: null,
  maxMarketCap: null,
  minVolume: null,
  minRelVolume: null,
  minLiquidity: null,
  minHolderGrowth: null,
  minWhaleAccumulation: null,
  minSmartMoney: null,
  maxConcentration: null,
  minChange1h: null,
  minChange24h: null,
  maxChange24h: null,
  minChange7d: null,
  rsiMin: null,
  rsiMax: null,
  minAdx: null,
  minAiScore: null,
  minConfidence: null,
  maxRisk: null,
  minSocial: null,
  minNews: null,
  minBuyPressure: null,
  requireSignals: [],
  logic: "and",
  sort: "aiScore",
  desc: true,
};

export type Preset = { id: string; name: string; blurb: string; filters: Partial<ScanFilters> };

export const presets: Preset[] = [
  { id: "high-momentum", name: "High Momentum", blurb: "Strong 24h trend with expanding volume", filters: { minChange24h: 5, minRelVolume: 1.2, minAdx: 20, sort: "change24h" } },
  { id: "whale-accumulation", name: "Whale Accumulation", blurb: "Large wallets adding into strength", filters: { minWhaleAccumulation: 65, minSmartMoney: 60 } },
  { id: "ai-strong-buy", name: "AI Strong Buy", blurb: "Highest conviction AI setups", filters: { minAiScore: 80, minConfidence: 75 } },
  { id: "oversold", name: "Oversold Opportunities", blurb: "RSI washed out, structure intact", filters: { rsiMax: 32, maxRisk: 70, sort: "rsi", desc: false } },
  { id: "breakouts", name: "Breakout Candidates", blurb: "Pressing range highs on volume", filters: { requireSignals: ["breakout"], minRelVolume: 1.1 } },
  { id: "memecoins", name: "New Memecoins", blurb: "High-beta meme rotation", filters: { sectors: ["memecoin"], sort: "change24h" } },
  { id: "low-cap-gems", name: "Low Cap Gems", blurb: "Under $250M with quality scores", filters: { maxMarketCap: 250e6, minAiScore: 65 } },
  { id: "swing", name: "Swing Trade Setup", blurb: "Trending above EMA with room to run", filters: { minAdx: 22, rsiMin: 45, rsiMax: 68 } },
  { id: "scalping", name: "Scalping", blurb: "Highest short-term volatility & liquidity", filters: { minRelVolume: 1.5, minVolume: 50e6, sort: "relVolume" } },
  { id: "long-term", name: "Long-Term Investments", blurb: "Large caps with low risk scores", filters: { caps: ["large", "mid"], maxRisk: 45 } },
  { id: "solana", name: "Trending Solana Tokens", blurb: "Solana ecosystem rotation", filters: { query: "sol", sort: "change24h" } },
  { id: "most-discussed", name: "Most Discussed", blurb: "Highest social chatter", filters: { minSocial: 65, sort: "social" } },
  { id: "highest-sentiment", name: "Highest Social Sentiment", blurb: "Sentiment leaders", filters: { minSocial: 70, minNews: 60, sort: "social" } },
  { id: "most-liquid", name: "Most Liquid", blurb: "Deepest books and pools", filters: { minLiquidity: 100e6, sort: "volume24h" } },
  { id: "rel-volume", name: "Highest Relative Volume", blurb: "Volume explosions vs 30d average", filters: { minRelVolume: 2, sort: "relVolume" } },
  { id: "buy-pressure", name: "Buy Pressure", blurb: "Aggressive market buying", filters: { minBuyPressure: 62, sort: "aiScore" } },
];

export const sectorLabels: Record<Sector, string> = {
  layer1: "Layer 1",
  layer2: "Layer 2",
  defi: "DeFi",
  memecoin: "Memecoins",
  ai: "AI",
  gaming: "Gaming",
  rwa: "RWA",
  stablecoin: "Stablecoins",
  other: "Other",
};

export const capLabels: Record<CapBucket, string> = {
  nano: "Nano Cap",
  micro: "Micro Cap",
  small: "Small Cap",
  mid: "Mid Cap",
  large: "Large Cap",
};

export const signalLabels: Record<keyof Signals, string> = {
  breakout: "Breakout",
  breakdown: "Breakdown",
  gapUp: "Gap Up",
  gapDown: "Gap Down",
  highOfDay: "High of Day",
  lowOfDay: "Low of Day",
  nearHigh52: "Near 52w High",
  nearLow52: "Near 52w Low",
  goldenCross: "Golden Cross",
  deathCross: "Death Cross",
  oversold: "Oversold",
  overbought: "Overbought",
};

export function applyFilters(rows: LiveAsset[], f: ScanFilters): LiveAsset[] {
  const tests: ((a: LiveAsset) => boolean)[] = [];
  const add = (v: unknown, fn: (a: LiveAsset) => boolean) => {
    if (v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0) && v !== "") tests.push(fn);
  };

  add(f.sectors, (a) => f.sectors.includes(a.sector));
  add(f.caps, (a) => f.caps.includes(a.cap));
  add(f.minPrice, (a) => a.price >= (f.minPrice as number));
  add(f.maxPrice, (a) => a.price <= (f.maxPrice as number));
  add(f.minMarketCap, (a) => a.marketCap >= (f.minMarketCap as number));
  add(f.maxMarketCap, (a) => a.marketCap <= (f.maxMarketCap as number));
  add(f.minVolume, (a) => a.volume24h >= (f.minVolume as number));
  add(f.minRelVolume, (a) => a.relVolume >= (f.minRelVolume as number));
  add(f.minLiquidity, (a) => a.onchain.liquidity >= (f.minLiquidity as number));
  add(f.minHolderGrowth, (a) => a.onchain.holderGrowth >= (f.minHolderGrowth as number));
  add(f.minWhaleAccumulation, (a) => a.onchain.whaleAccumulation >= (f.minWhaleAccumulation as number));
  add(f.minSmartMoney, (a) => a.onchain.smartMoney >= (f.minSmartMoney as number));
  add(f.maxConcentration, (a) => a.onchain.topWalletConcentration <= (f.maxConcentration as number));
  add(f.minChange1h, (a) => a.change1h >= (f.minChange1h as number));
  add(f.minChange24h, (a) => a.change24h >= (f.minChange24h as number));
  add(f.maxChange24h, (a) => a.change24h <= (f.maxChange24h as number));
  add(f.minChange7d, (a) => a.change7d >= (f.minChange7d as number));
  add(f.rsiMin, (a) => a.indicators.rsi >= (f.rsiMin as number));
  add(f.rsiMax, (a) => a.indicators.rsi <= (f.rsiMax as number));
  add(f.minAdx, (a) => a.indicators.adx >= (f.minAdx as number));
  add(f.minAiScore, (a) => a.aiScore >= (f.minAiScore as number));
  add(f.minConfidence, (a) => a.aiConfidence >= (f.minConfidence as number));
  add(f.maxRisk, (a) => a.riskScore <= (f.maxRisk as number));
  add(f.minSocial, (a) => a.sentiment.social >= (f.minSocial as number));
  add(f.minNews, (a) => a.sentiment.news >= (f.minNews as number));
  add(f.minBuyPressure, (a) => a.buyPressure >= (f.minBuyPressure as number));
  add(f.requireSignals, (a) => f.requireSignals.every((s) => a.signals[s]));

  const q = f.query.trim().toLowerCase();
  let out = rows.filter((a) => {
    if (q && !(a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q) || a.id.includes(q))) return false;
    if (tests.length === 0) return true;
    return f.logic === "and" ? tests.every((t) => t(a)) : tests.some((t) => t(a));
  });

  const value = (a: LiveAsset): number => {
    switch (f.sort) {
      case "marketCap": return a.marketCap;
      case "volume24h": return a.volume24h;
      case "relVolume": return a.relVolume;
      case "change24h": return a.change24h;
      case "change7d": return a.change7d;
      case "rsi": return a.indicators.rsi;
      case "riskScore": return a.riskScore;
      case "social": return a.sentiment.social;
      default: return a.aiScore;
    }
  };
  out = [...out].sort((a, b) => (f.desc ? value(b) - value(a) : value(a) - value(b)));
  return out;
}

export const fmtUsdc = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
};

export const fmtPctc = (n: number) => `${n > 0 ? "+" : ""}${(n ?? 0).toFixed(2)}%`;
