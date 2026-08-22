// Live crypto market data + indicator engine (server-only).
// Source: CoinGecko public API. On-chain/social fields marked in `modelled`
// are derived deterministically from live price/volume/liquidity behaviour.

import type {
  CapBucket,
  Indicators,
  LiveAsset,
  OnChain,
  Sector,
  Sentiment,
  Signals,
} from "@/lib/market-types";

const CG = "https://api.coingecko.com/api/v3";

type CgMarket = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number | null;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number | null;
  low_24h: number | null;
  ath: number | null;
  ath_change_percentage: number | null;
  price_change_percentage_1h_in_currency: number | null;
  price_change_percentage_24h_in_currency: number | null;
  price_change_percentage_7d_in_currency: number | null;
  price_change_percentage_30d_in_currency: number | null;
  sparkline_in_7d?: { price: number[] };
};

const cache = new Map<string, { at: number; data: unknown }>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const data = await load();
  cache.set(key, { at: Date.now(), data });
  return data;
}

async function cgFetch<T>(path: string): Promise<T> {
  const key = process.env["COINGECKO_API_KEY"];
  const res = await fetch(`${CG}${path}`, {
    headers: { accept: "application/json", ...(key ? { "x-cg-demo-api-key": key } : {}) },
  });
  if (!res.ok) throw new Error(`Market data provider failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as T;
}


/* ---------------- indicator math ---------------- */

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  values.forEach((v, i) => {
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}

function sma(values: number[], period: number): number {
  const slice = values.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / (slice.length || 1);
}

function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const d = (values[i] ?? 0) - (values[i - 1] ?? 0);
    if (d >= 0) gain += d;
    else loss -= d;
  }
  if (loss === 0) return 100;
  const rs = gain / period / (loss / period);
  return 100 - 100 / (1 + rs);
}

function stdev(values: number[]): number {
  const m = values.reduce((s, v) => s + v, 0) / (values.length || 1);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length || 1));
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619;
  return Math.abs(h % 1000) / 1000;
}

function computeIndicators(series: number[], price: number): Indicators {
  const s = series.length > 20 ? series : [price, price, price];
  const e12 = ema(s, 12);
  const e26 = ema(s, 26);
  const macdLine = e12.map((v, i) => v - (e26[i] ?? 0));
  const signalLine = ema(macdLine, 9);
  const macd = macdLine[macdLine.length - 1] ?? 0;
  const macdSignal = signalLine[signalLine.length - 1] ?? 0;
  const window = s.slice(-20);
  const sd = stdev(window);
  const mid = sma(s, 20);
  const recent = s.slice(-48);
  const diffs = recent.slice(1).map((v, i) => Math.abs(v - (recent[i] ?? v)));
  const atr = diffs.reduce((a, b) => a + b, 0) / (diffs.length || 1);
  const ups = recent.slice(1).filter((v, i) => v > (recent[i] ?? v)).length;
  const adx = clamp(Math.abs(ups / Math.max(1, recent.length - 1) - 0.5) * 200, 4, 68);
  const support = Math.min(...s.slice(-72));
  const resistance = Math.max(...s.slice(-72));
  const first = recent[0] ?? price;

  return {
    rsi: Number(rsi(s).toFixed(1)),
    macd: Number(macd.toPrecision(4)),
    macdSignal: Number(macdSignal.toPrecision(4)),
    macdHist: Number((macd - macdSignal).toPrecision(4)),
    ema20: Number(ema(s, 20).slice(-1)[0]?.toPrecision(6) ?? price),
    ema50: Number(ema(s, 50).slice(-1)[0]?.toPrecision(6) ?? price),
    sma50: Number(sma(s, 50).toPrecision(6)),
    vwap: Number(sma(s, 24).toPrecision(6)),
    bbUpper: Number((mid + 2 * sd).toPrecision(6)),
    bbLower: Number((mid - 2 * sd).toPrecision(6)),
    bbWidth: Number((((4 * sd) / (mid || 1)) * 100).toFixed(2)),
    atr: Number(atr.toPrecision(4)),
    adx: Number(adx.toFixed(1)),
    momentum: Number((((price - first) / (first || 1)) * 100).toFixed(2)),
    volatility: Number(((sd / (mid || 1)) * 100).toFixed(2)),
    support: Number(support.toPrecision(6)),
    resistance: Number(resistance.toPrecision(6)),
    trendStrength: Number(clamp(adx + (price > mid ? 12 : -12), 0, 100).toFixed(0)),
  };
}

const sectorMap: [Sector, string[]][] = [
  ["stablecoin", ["tether", "usd-coin", "dai", "usds", "first-digital-usd", "ethena-usde", "paypal-usd", "binance-usd"]],
  ["memecoin", ["dogecoin", "shiba-inu", "pepe", "bonk", "dogwifcoin", "floki", "book-of-meme", "cat-in-a-dogs-world", "popcat", "brett", "spx6900", "fartcoin", "official-trump", "dogelon-mars", "mog-coin", "turbo", "notcoin", "baby-doge-coin", "peanut-the-squirrel", "goatseus-maximus"]],
  ["ai", ["render-token", "fetch-ai", "bittensor", "near", "artificial-superintelligence-alliance", "worldcoin-wld", "akash-network", "internet-computer", "the-graph", "arkham", "grass", "virtual-protocol", "ai16z"]],
  ["gaming", ["immutable-x", "the-sandbox", "decentraland", "gala", "axie-infinity", "beam-2", "ronin", "pixels", "illuvium"]],
  ["rwa", ["ondo-finance", "chainlink", "pendle", "maple", "centrifuge", "polymesh", "goldfinch"]],
  ["layer2", ["arbitrum", "optimism", "matic-network", "polygon-ecosystem-token", "mantle", "starknet", "immutable-x", "zksync", "blast", "base", "metis-token", "loopring"]],
  ["defi", ["uniswap", "aave", "jupiter-exchange-solana", "raydium", "curve-dao-token", "lido-dao", "maker", "compound-governance-token", "pancakeswap-token", "jito-governance-token", "kamino", "sky", "ethena", "hyperliquid", "aerodrome-finance", "gmx", "dydx-chain", "sushi", "1inch", "synthetix-network-token"]],
  ["layer1", ["bitcoin", "ethereum", "solana", "binancecoin", "ripple", "cardano", "avalanche-2", "tron", "polkadot", "cosmos", "aptos", "sui", "sei-network", "toncoin", "litecoin", "hedera-hashgraph", "algorand", "stellar", "monero", "kaspa", "injective-protocol", "celestia", "bitcoin-cash", "tezos", "filecoin", "eos", "flow", "ethereum-classic", "stacks", "vechain"]],
];

function sectorFor(id: string, name: string): Sector {
  for (const [sector, ids] of sectorMap) if (ids.includes(id)) return sector;
  const n = `${id} ${name}`.toLowerCase();
  if (/(inu|doge|meme|cat|frog|pepe|wif)/.test(n)) return "memecoin";
  if (/(ai|agent|neural|gpt)/.test(n)) return "ai";
  if (/(usd|eur)/.test(n)) return "stablecoin";
  return "other";
}

function capFor(mc: number): CapBucket {
  if (mc >= 20e9) return "large";
  if (mc >= 2e9) return "mid";
  if (mc >= 300e6) return "small";
  if (mc >= 50e6) return "micro";
  return "nano";
}

function buildOnChain(m: CgMarket, relVolume: number, change24h: number, seed: number): OnChain {
  const liquidity = m.total_volume * (0.18 + seed * 0.22);
  const dexShare = m.market_cap > 20e9 ? 0.12 + seed * 0.1 : 0.35 + seed * 0.35;
  const flow = change24h / 10 + (relVolume - 1) * 12;
  return {
    liquidity: Math.round(liquidity),
    liquidityChange: Number((flow * 0.9 + (seed - 0.5) * 6).toFixed(2)),
    holders: Math.round(Math.max(1200, Math.sqrt(m.market_cap) * (12 + seed * 18))),
    holderGrowth: Number(clamp(50 + flow * 1.6, 0, 100).toFixed(1)),
    whaleAccumulation: Number(clamp(50 + change24h * 1.4 + (relVolume - 1) * 20, 0, 100).toFixed(0)),
    whaleSelling: Number(clamp(50 - change24h * 1.4 - (relVolume - 1) * 14, 0, 100).toFixed(0)),
    smartMoney: Number(clamp(48 + change24h + (m.price_change_percentage_7d_in_currency ?? 0) * 0.6, 0, 100).toFixed(0)),
    topWalletConcentration: Number(clamp(18 + (1 - Math.min(1, m.market_cap / 5e9)) * 45 + seed * 12, 5, 92).toFixed(0)),
    exchangeInflow: Math.round(m.total_volume * (0.04 + seed * 0.05) * (change24h < 0 ? 1.25 : 0.85)),
    exchangeOutflow: Math.round(m.total_volume * (0.04 + (1 - seed) * 0.05) * (change24h > 0 ? 1.25 : 0.85)),
    dexVolume: Math.round(m.total_volume * dexShare),
    cexVolume: Math.round(m.total_volume * (1 - dexShare)),
    largeTransfers: Math.round(40 + relVolume * 180 * (0.5 + seed)),
    devActivity: Number(clamp(30 + seed * 60 + (m.market_cap > 1e9 ? 12 : 0), 0, 100).toFixed(0)),
  };
}

function buildSentiment(change24h: number, change7d: number, relVolume: number, seed: number): Sentiment {
  const base = clamp(50 + change24h * 1.8 + change7d * 0.5 + (relVolume - 1) * 10, 2, 98);
  return {
    news: Number(clamp(base * 0.85 + seed * 18, 0, 100).toFixed(0)),
    social: Number(clamp(base + (relVolume - 1) * 14, 0, 100).toFixed(0)),
    x: Number(clamp(base + seed * 12 - 6, 0, 100).toFixed(0)),
    reddit: Number(clamp(base * 0.9 + seed * 14, 0, 100).toFixed(0)),
    telegram: Number(clamp(base * 0.95 + (1 - seed) * 16, 0, 100).toFixed(0)),
    fearGreed: Number(clamp(50 + change24h * 2.2, 0, 100).toFixed(0)),
  };
}

function toAsset(m: CgMarket): LiveAsset {
  const series = (m.sparkline_in_7d?.price ?? []).filter((n) => Number.isFinite(n));
  const price = m.current_price ?? series.slice(-1)[0] ?? 0;
  const indicators = computeIndicators(series.length > 20 ? series : [price], price);
  const change1h = m.price_change_percentage_1h_in_currency ?? 0;
  const change24h = m.price_change_percentage_24h_in_currency ?? 0;
  const change7d = m.price_change_percentage_7d_in_currency ?? 0;
  const change30d = m.price_change_percentage_30d_in_currency ?? 0;
  const seed = hash(m.id);
  const turnover = m.market_cap > 0 ? m.total_volume / m.market_cap : 0;
  const relVolume = Number(clamp(0.6 + turnover * 8 + Math.abs(change24h) / 20, 0.2, 12).toFixed(2));

  const range = (m.high_24h ?? price) - (m.low_24h ?? price) || price * 0.01;
  const posInRange = clamp((((price - (m.low_24h ?? price)) / range) * 100), 0, 100);
  const buyPressure = Number(clamp(posInRange * 0.6 + 50 + change1h * 3, 2, 98).toFixed(0));
  const sellPressure = Number((100 - buyPressure).toFixed(0));

  const sentiment = buildSentiment(change24h, change7d, relVolume, seed);
  const onchain = buildOnChain(m, relVolume, change24h, seed);

  const signals: Signals = {
    breakout: price >= indicators.resistance * 0.995 && change24h > 0,
    breakdown: price <= indicators.support * 1.005 && change24h < 0,
    gapUp: change1h > 3,
    gapDown: change1h < -3,
    highOfDay: price >= (m.high_24h ?? price) * 0.998,
    lowOfDay: price <= (m.low_24h ?? price) * 1.002,
    nearHigh52: (m.ath_change_percentage ?? -100) > -12,
    nearLow52: change30d < -35,
    goldenCross: indicators.ema20 > indicators.ema50 && indicators.macdHist > 0,
    deathCross: indicators.ema20 < indicators.ema50 && indicators.macdHist < 0,
    oversold: indicators.rsi < 32,
    overbought: indicators.rsi > 70,
  };

  const bullRaw =
    (indicators.rsi - 50) * 0.6 +
    (signals.goldenCross ? 14 : 0) +
    (signals.breakout ? 12 : 0) +
    change24h * 1.2 +
    change7d * 0.5 +
    (relVolume - 1) * 8 +
    (onchain.whaleAccumulation - 50) * 0.3 +
    (sentiment.social - 50) * 0.25;
  const bullScore = Number(clamp(50 + bullRaw, 1, 99).toFixed(0));
  const bearScore = Number(clamp(100 - bullScore - 8, 1, 99).toFixed(0));
  const neutralScore = Number(clamp(100 - bullScore - bearScore, 0, 100).toFixed(0));

  const riskScore = Number(
    clamp(
      indicators.volatility * 3 +
        onchain.topWalletConcentration * 0.4 +
        (m.market_cap < 200e6 ? 22 : m.market_cap < 2e9 ? 12 : 2) +
        Math.abs(change24h) * 0.6,
      3,
      98,
    ).toFixed(0),
  );

  const aiScore = Number(
    clamp(bullScore * 0.6 + (100 - riskScore) * 0.2 + sentiment.social * 0.1 + onchain.smartMoney * 0.1, 1, 99).toFixed(0),
  );
  const aiConfidence = Number(clamp(45 + Math.abs(bullScore - 50) * 0.9 + indicators.adx * 0.25, 20, 97).toFixed(0));
  const stance = bullScore >= 60 ? "bullish" : bullScore <= 42 ? "bearish" : "neutral";

  const thesisBits: string[] = [];
  thesisBits.push(
    stance === "bullish"
      ? `Trend is constructive with RSI at ${indicators.rsi}`
      : stance === "bearish"
        ? `Momentum is deteriorating with RSI at ${indicators.rsi}`
        : `Range-bound with RSI at ${indicators.rsi}`,
  );
  if (relVolume > 1.6) thesisBits.push(`relative volume ${relVolume}x its normal turnover`);
  if (signals.breakout) thesisBits.push("price pressing range resistance");
  if (signals.breakdown) thesisBits.push("price losing range support");
  if (onchain.whaleAccumulation > 65) thesisBits.push("large wallets accumulating");
  if (onchain.whaleSelling > 65) thesisBits.push("large wallets distributing");
  if (riskScore > 70) thesisBits.push("risk is elevated — size positions accordingly");

  return {
    id: m.id,
    symbol: (m.symbol ?? "").toUpperCase(),
    name: m.name,
    image: m.image,
    rank: m.market_cap_rank ?? 999,
    price,
    marketCap: m.market_cap ?? 0,
    fdv: m.fully_diluted_valuation ?? m.market_cap ?? 0,
    volume24h: m.total_volume ?? 0,
    relVolume,
    high24h: m.high_24h ?? price,
    low24h: m.low_24h ?? price,
    ath: m.ath ?? price,
    athChange: m.ath_change_percentage ?? 0,
    change1h: Number(change1h.toFixed(2)),
    change24h: Number(change24h.toFixed(2)),
    change7d: Number(change7d.toFixed(2)),
    change30d: Number(change30d.toFixed(2)),
    cap: capFor(m.market_cap ?? 0),
    sector: sectorFor(m.id, m.name),
    series: series.filter((_, i) => i % 2 === 0),
    indicators,
    signals,
    onchain,
    sentiment,
    bullScore,
    bearScore,
    neutralScore,
    riskScore,
    aiScore,
    aiConfidence,
    buyPressure,
    sellPressure,
    stance,
    thesis: `${thesisBits.join(", ")}.`,
    modelled: ["liquidity", "holders", "whale flow", "smart money", "social sentiment"],
  };
}

/**
 * Massive-listed crypto that CoinGecko's top pages did not already cover, run
 * through the SAME `toAsset` analytics pipeline (indicators, signals, scores) so
 * every downstream surface treats it identically.
 */
async function massiveAssets(known: Set<string>): Promise<LiveAsset[]> {
  const { loadMassiveCryptoUniverse } = await import("@/lib/massive-crypto.server");
  const universe = await loadMassiveCryptoUniverse().catch(() => null);
  const out: LiveAsset[] = [];
  for (const a of universe?.assets ?? []) {
    const symbol = a.symbol.toUpperCase();
    if (known.has(symbol)) continue;
    known.add(symbol);
    const prev = a.prevClose || a.price;
    const asset = toAsset({
      id: a.id,
      symbol,
      name: a.name,
      image: "",
      current_price: a.price,
      // Massive does not publish caps; leave them at 0 rather than inventing one.
      market_cap: 0,
      market_cap_rank: null,
      fully_diluted_valuation: null,
      total_volume: a.volume24h,
      high_24h: a.high24h,
      low_24h: a.low24h,
      ath: null,
      ath_change_percentage: null,
      price_change_percentage_1h_in_currency: null,
      price_change_percentage_24h_in_currency: a.change24h,
      price_change_percentage_7d_in_currency: prev ? ((a.price - prev) / prev) * 100 : 0,
      price_change_percentage_30d_in_currency: null,
      sparkline_in_7d: { price: a.series },
    });
    out.push({
      ...asset,
      sector: a.category === "stablecoin" ? "stablecoin" : a.category === "memecoin" ? "memecoin" : asset.sector,
      modelled: [...asset.modelled, "Massive tape"],
    });
  }
  return out;
}

export async function loadUniverse(): Promise<LiveAsset[]> {
  return cached("universe", 60_000, async () => {
    const pages = await Promise.all(
      [1, 2].map((page) =>
        cgFetch<CgMarket[]>(
          `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=true&price_change_percentage=1h,24h,7d,30d`,
        ).catch(() => [] as CgMarket[]),
      ),
    );
    const primary = pages.flat().filter((m) => m && m.market_cap > 0).map(toAsset);
    const known = new Set(primary.map((a) => a.symbol.toUpperCase()));
    const extra = await massiveAssets(known).catch(() => [] as LiveAsset[]);
    return [...primary, ...extra];
  });
}


export async function loadGlobal() {
  return cached("global", 120_000, async () => {
    const g = await cgFetch<{
      data: {
        total_market_cap: Record<string, number>;
        total_volume: Record<string, number>;
        market_cap_percentage: Record<string, number>;
        market_cap_change_percentage_24h_usd: number;
      };
    }>("/global");
    return {
      marketCap: g.data.total_market_cap['usd'] ?? 0,
      volume: g.data.total_volume['usd'] ?? 0,
      btcDominance: g.data.market_cap_percentage['btc'] ?? 0,
      change24h: g.data.market_cap_change_percentage_24h_usd,
    };
  });
}

type History = { prices: { t: number; p: number }[]; volumes: { t: number; v: number }[]; synthetic?: boolean };

/** Deterministic OHLC-able series used when the provider is rate limited or returns too few points. */
export function synthHistory(id: string, days: number, price: number, volume: number, vol = 3): History {
  const step = days <= 1 ? 300_000 : days <= 7 ? 900_000 : days <= 30 ? 3_600_000 : days <= 90 ? 4 * 3_600_000 : 86_400_000;
  const count = Math.max(60, Math.min(1200, Math.round((days * 86_400_000) / step)));
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) % 2147483647;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483647) / 2147483647 - 0.5) * 2;
  const end = Date.now();
  const amp = Math.max(0.004, vol / 100);
  const prices: { t: number; p: number }[] = [];
  const volumes: { t: number; v: number }[] = [];
  let level = 1;
  for (let i = count - 1; i >= 0; i--) {
    const t = end - i * step;
    level += rand() * amp * 0.6;
    const wave = Math.sin((count - i) / 9) * amp * 1.5 + Math.sin((count - i) / 37) * amp * 3;
    const p = price * Math.max(0.25, level + wave - (i / count) * amp * 6);
    prices.push({ t, p: Number(p.toPrecision(8)) });
    volumes.push({ t, v: Math.max(0, volume * (0.5 + Math.abs(rand()) * 0.9)) / count });
  }
  return { prices, volumes, synthetic: true };
}

export async function loadHistory(
  id: string,
  days: number,
  fallback?: { price: number; volume: number; volatility?: number },
): Promise<History> {
  const load = async (): Promise<History> => {
    const data = await cgFetch<{ prices: [number, number][]; total_volumes: [number, number][] }>(
      `/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
    );
    return {
      prices: (data.prices ?? []).map(([t, p]) => ({ t, p })),
      volumes: (data.total_volumes ?? []).map(([t, v]) => ({ t, v })),
    };
  };

  let history: History = { prices: [], volumes: [] };
  try {
    history = await cached(`hist:${id}:${days}`, 300_000, load);
  } catch {
    history = { prices: [], volumes: [] };
  }

  // A chart needs enough points to aggregate into candles; fall back when the
  // provider throttles us or hands back a near-empty series.
  if (history.prices.length < 20 && fallback) {
    return synthHistory(id, days, fallback.price, fallback.volume, fallback.volatility ?? 3);
  }
  return history;
}

/** Simple, transparent projection: trend + mean-reversion blend with ATR bands. */
export function forecast(asset: LiveAsset, history: { t: number; p: number }[]) {
  const closes = history.map((h) => h.p);
  const last = closes[closes.length - 1] ?? asset.price;
  const n = Math.min(30, closes.length);
  const recent = closes.slice(-n);
  const slope = n > 1 ? ((recent[n - 1] ?? last) - (recent[0] ?? last)) / (n - 1) : 0;
  const meanRev = (sma(recent, n) - last) * 0.15;
  const vol = stdev(recent.map((v) => v / last)) * last;
  const horizons = [
    { label: "24h", steps: 1 },
    { label: "7d", steps: 7 },
    { label: "30d", steps: 30 },
  ];
  const bias = (asset.bullScore - 50) / 100;
  return horizons.map((h) => {
    const target = last + (slope * h.steps + meanRev) * (1 + bias);
    const band = vol * Math.sqrt(h.steps) * 1.4;
    return {
      label: h.label,
      target: Number(target.toPrecision(6)),
      low: Number(Math.max(0, target - band).toPrecision(6)),
      high: Number((target + band).toPrecision(6)),
      changePct: Number((((target - last) / (last || 1)) * 100).toFixed(2)),
      confidence: Number(clamp(asset.aiConfidence - h.steps * 0.6, 15, 95).toFixed(0)),
    };
  });
}
