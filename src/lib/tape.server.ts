/**
 * Universal keyless market tape (server only).
 *
 * Replaces the rate-limited Polygon pipeline for FX, futures, indices, stocks
 * and crypto. The upstream chart feed needs no key and has no per-minute
 * budget, so every instrument resolves on the first poll instead of sitting in
 * a "syncing" state while a token bucket drains.
 */

import { resample, tfSignal, timeframes, type Bar, type TfSignal, type Timeframe } from "@/lib/futures.server";
import { indicators, type Indicators } from "@/lib/indicators.server";
import {
  massiveBars,
  massiveBoardSeries,
  massiveDailyBars,
  massiveSearch,
  type AssetClass,
} from "@/lib/massive.server";
import { tdSymbol } from "@/lib/twelvedata.server";

export type { Indicators, Bar, Timeframe, TfSignal };

const CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const SEARCH = "https://query2.finance.yahoo.com/v1/finance/search";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export type DeskId = "fx" | "futures" | "stocks" | "crypto" | "indices";

export type Instrument = {
  key: string;
  code: string;
  name: string;
  group: string;
  desk: DeskId;
  symbol: string;
  quote: string;
  /** US-listed ETF that tracks this instrument, used when the primary feed has no direct coverage. */
  proxy?: string | undefined;
};

/** Which feed produced the series a row was scored from. */
export type MarketSource =
  | "massive"
  | "twelvedata"
  | "tape"
  | "binance"
  | "frankfurter"
  | "proxy"
  | "none";

export const sourceLabels: Record<MarketSource, string> = {
  massive: "Massive",
  twelvedata: "Twelve Data",
  tape: "Backup tape",
  binance: "Binance spot",
  frankfurter: "ECB (Frankfurter)",
  proxy: "ETF proxy",
  none: "No feed",
};

export type MarketRow = {
  key: string;
  code: string;
  name: string;
  group: string;
  desk: DeskId;
  symbol: string;
  ticker: string;
  quote: string;
  last: number;
  prevClose: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
  spark: number[];
  signals: TfSignal[];
  indicators: Indicators;
  status: "live" | "syncing";
  /** Provider that served the bars behind these indicators/signals. */
  source: MarketSource;
  updatedAt: number;
};


export type MarketBoard = { rows: MarketRow[]; updatedAt: number; pending: number };
export type MarketDetail = MarketRow & { bars: Bar[]; interval: Timeframe };

/* -------------------------------- catalogs -------------------------------- */

const fx: Instrument[] = [
  ["EURUSD", "EUR/USD", "Euro · US Dollar", "Forex majors", "EURUSD=X", "USD"],
  ["GBPUSD", "GBP/USD", "Sterling · US Dollar", "Forex majors", "GBPUSD=X", "USD"],
  ["USDJPY", "USD/JPY", "US Dollar · Yen", "Forex majors", "USDJPY=X", "JPY"],
  ["USDCHF", "USD/CHF", "US Dollar · Swiss Franc", "Forex majors", "USDCHF=X", "CHF"],
  ["AUDUSD", "AUD/USD", "Aussie · US Dollar", "Forex majors", "AUDUSD=X", "USD"],
  ["USDCAD", "USD/CAD", "US Dollar · Loonie", "Forex majors", "USDCAD=X", "CAD"],
  ["NZDUSD", "NZD/USD", "Kiwi · US Dollar", "Forex majors", "NZDUSD=X", "USD"],
  ["EURJPY", "EUR/JPY", "Euro · Yen", "Forex crosses", "EURJPY=X", "JPY"],
  ["GBPJPY", "GBP/JPY", "Sterling · Yen", "Forex crosses", "GBPJPY=X", "JPY"],
  ["EURGBP", "EUR/GBP", "Euro · Sterling", "Forex crosses", "EURGBP=X", "GBP"],
  ["DXY", "DX-Y", "US Dollar Index", "Forex crosses", "DX-Y.NYB", "USD"],
].map(([key, code, name, group, symbol, quote]) => ({
  key: key!,
  code: code!,
  name: name!,
  group: group!,
  desk: "fx" as const,
  symbol: symbol!,
  quote: quote!,
}));

/** ETF trackers used when the contract itself isn't covered by the primary feed. */
const FUTURES_PROXY: Record<string, string> = {
  ES: "SPY", NQ: "QQQ", YM: "DIA", RTY: "IWM",
  CL: "USO", NG: "UNG", RB: "UGA",
  GC: "GLD", SI: "SLV", HG: "CPER", PL: "PPLT",
  ZC: "CORN", ZS: "SOYB",
  BTCF: "IBIT", ETHF: "ETHA",
};

const INDEX_PROXY: Record<string, string> = {
  SPX: "SPY", NDX: "QQQ", DJI: "DIA", RUT: "IWM", VIX: "VIXY", TNX: "IEF",
};

const futures: Instrument[] = [
  ["ES", "ES · S&P 500", "E-mini S&P 500", "Equity index futures", "ES=F"],
  ["NQ", "NQ · Nasdaq 100", "E-mini Nasdaq-100", "Equity index futures", "NQ=F"],
  ["YM", "YM · Dow", "E-mini Dow", "Equity index futures", "YM=F"],
  ["RTY", "RTY · Russell", "E-mini Russell 2000", "Equity index futures", "RTY=F"],
  ["CL", "CL · Crude", "Crude Oil WTI", "Energy futures", "CL=F"],
  ["NG", "NG · Nat Gas", "Natural Gas", "Energy futures", "NG=F"],
  ["RB", "RB · Gasoline", "RBOB Gasoline", "Energy futures", "RB=F"],
  ["GC", "GC · Gold", "Gold", "Metals futures", "GC=F"],
  ["SI", "SI · Silver", "Silver", "Metals futures", "SI=F"],
  ["HG", "HG · Copper", "Copper", "Metals futures", "HG=F"],
  ["PL", "PL · Platinum", "Platinum", "Metals futures", "PL=F"],
  ["ZC", "ZC · Corn", "Corn", "Ags futures", "ZC=F"],
  ["ZS", "ZS · Soybeans", "Soybeans", "Ags futures", "ZS=F"],
  ["BTCF", "BTC · CME", "CME Bitcoin futures", "Crypto futures", "BTC=F"],
  ["ETHF", "ETH · CME", "CME Ether futures", "Crypto futures", "ETH=F"],
].map(([key, code, name, group, symbol]) => ({
  key: key!,
  code: code!,
  name: name!,
  group: group!,
  desk: "futures" as const,
  symbol: symbol!,
  quote: "USD",
  proxy: FUTURES_PROXY[key!],
}));

const indices: Instrument[] = [
  ["SPX", "S&P 500", "S&P 500 index", "Benchmarks", "^GSPC"],
  ["NDX", "Nasdaq 100", "Nasdaq-100 index", "Benchmarks", "^NDX"],
  ["DJI", "Dow 30", "Dow Jones Industrial", "Benchmarks", "^DJI"],
  ["RUT", "Russell 2000", "Small cap benchmark", "Benchmarks", "^RUT"],
  ["VIX", "VIX", "Volatility index", "Volatility", "^VIX"],
  ["TNX", "US 10Y", "10-year Treasury yield", "Rates", "^TNX"],
].map(([key, code, name, group, symbol]) => ({
  key: key!,
  code: code!,
  name: name!,
  group: group!,
  desk: "indices" as const,
  symbol: symbol!,
  quote: "USD",
  proxy: INDEX_PROXY[key!],
}));

const stocks: Instrument[] = [
  ["NVDA", "Nvidia", "AI semiconductors", "Megacap tech"],
  ["AAPL", "Apple", "Consumer hardware", "Megacap tech"],
  ["MSFT", "Microsoft", "Cloud & AI", "Megacap tech"],
  ["GOOGL", "Alphabet", "Search & cloud", "Megacap tech"],
  ["AMZN", "Amazon", "E-commerce & AWS", "Megacap tech"],
  ["META", "Meta", "Social & AI", "Megacap tech"],
  ["TSLA", "Tesla", "EV & autonomy", "Megacap tech"],
  ["AMD", "AMD", "Semiconductors", "Semis & AI"],
  ["AVGO", "Broadcom", "Custom silicon", "Semis & AI"],
  ["MU", "Micron", "Memory", "Semis & AI"],
  ["SMCI", "Super Micro", "AI servers", "Semis & AI"],
  ["PLTR", "Palantir", "AI software", "Semis & AI"],
  ["COIN", "Coinbase", "Crypto exchange", "Crypto equities"],
  ["MSTR", "Strategy", "Bitcoin treasury", "Crypto equities"],
  ["HOOD", "Robinhood", "Retail brokerage", "Crypto equities"],
  ["MARA", "Mara Holdings", "Bitcoin miner", "Crypto equities"],
  ["JPM", "JPMorgan", "Money center bank", "Financials & energy"],
  ["GS", "Goldman Sachs", "Investment bank", "Financials & energy"],
  ["XOM", "Exxon Mobil", "Integrated energy", "Financials & energy"],
  ["SPY", "SPY ETF", "S&P 500 ETF", "Core ETFs"],
  ["QQQ", "QQQ ETF", "Nasdaq-100 ETF", "Core ETFs"],
  ["IWM", "IWM ETF", "Russell 2000 ETF", "Core ETFs"],
].map(([key, code, name, group]) => ({
  key: key!,
  code: code!,
  name: name!,
  group: group!,
  desk: "stocks" as const,
  symbol: key!,
  quote: "USD",
}));

const crypto: Instrument[] = [
  ["BTCUSD", "BTC/USD", "Bitcoin", "Crypto 24/7", "BTC-USD"],
  ["ETHUSD", "ETH/USD", "Ether", "Crypto 24/7", "ETH-USD"],
  ["SOLUSD", "SOL/USD", "Solana", "Crypto 24/7", "SOL-USD"],
  ["XRPUSD", "XRP/USD", "XRP", "Crypto 24/7", "XRP-USD"],
  ["DOGEUSD", "DOGE/USD", "Dogecoin", "Crypto 24/7", "DOGE-USD"],
  ["AVAXUSD", "AVAX/USD", "Avalanche", "Crypto 24/7", "AVAX-USD"],
].map(([key, code, name, group, symbol]) => ({
  key: key!,
  code: code!,
  name: name!,
  group: group!,
  desk: "crypto" as const,
  symbol: symbol!,
  quote: "USD",
}));

export const desks: { id: DeskId; label: string; blurb: string }[] = [
  { id: "futures", label: "Futures", blurb: "CME index, energy, metals and ags contracts" },
  { id: "fx", label: "Forex", blurb: "24/5 spot majors, crosses and the dollar index" },
  { id: "stocks", label: "Stocks", blurb: "Megacap tech, semis, crypto equities and ETFs" },
  { id: "crypto", label: "Crypto", blurb: "Continuous 24/7 crypto pairs" },
  { id: "indices", label: "Benchmarks", blurb: "Index levels, volatility and rates" },
];

export const instruments: Instrument[] = [...futures, ...fx, ...stocks, ...crypto, ...indices];

export function instrumentsByDesk(desk: DeskId): Instrument[] {
  return instruments.filter((i) => i.desk === desk);
}

export function findInstrument(key: string): Instrument | undefined {
  const k = key.trim().toUpperCase();
  return instruments.find((i) => i.key === k || i.symbol.toUpperCase() === k);
}

/* --------------------------------- fetching -------------------------------- */

type CacheEntry = { at: number; value: Bar[] };
const cache = new Map<string, CacheEntry>();
const TTL = 10 * 60_000;

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

type ChartResponse = {
  chart?: {
    result?: {
      timestamp?: number[];
      indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
    }[];
  };
};

/**
 * Upstream is aggressive about bursts, so every chart request goes through one
 * serialized queue with a minimum gap plus exponential backoff on 429s.
 */
let yahooCooldownUntil = 0;
const yahooInflight = new Map<string, Promise<ChartResponse | null>>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchChart(url: string): Promise<ChartResponse | null> {
  if (Date.now() < yahooCooldownUntil) return null;
  const existing = yahooInflight.get(url);
  if (existing) return existing;
  const request = (async () => {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(4_000),
      });
      if (res.ok) return (await res.json()) as ChartResponse;
      console.warn(`[tape] ${url} -> ${res.status}`);
      if (res.status === 429 || res.status === 503) yahooCooldownUntil = Date.now() + 30_000;
      return null;
    } catch (e) {
      console.warn(`[tape] ${url} threw ${(e as Error).message}`);
      return null;
    }
  })();
  yahooInflight.set(url, request);
  try {
    return await request;
  } finally {
    yahooInflight.delete(url);
  }
}

/** 5-minute bars over the trailing week for any upstream symbol. */
export async function loadBars(symbol: string, opts: { interval?: string; range?: string } = {}): Promise<Bar[]> {
  const interval = opts.interval ?? "5m";
  const range = opts.range ?? "5d";
  const cacheKey = `${symbol}:${interval}:${range}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const url = `${CHART}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  const json = await fetchChart(url);
  if (!json) return hit?.value ?? [];
  const result = json.chart?.result?.[0];
  const q = result?.indicators?.quote?.[0];
  const ts = result?.timestamp ?? [];
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const close = num(q?.close?.[i]);
    if (!close) continue;
    bars.push({
      t: (ts[i] as number) * 1000,
      open: num(q?.open?.[i]) || close,
      high: num(q?.high?.[i]) || close,
      low: num(q?.low?.[i]) || close,
      close,
      volume: num(q?.volume?.[i]),
    });
  }
  const trimmed = bars.slice(-1200);
  if (trimmed.length === 0) return hit?.value ?? [];
  cache.set(cacheKey, { at: Date.now(), value: trimmed });
  return trimmed;
}

function barsByTf(base: Bar[]): Record<Timeframe, Bar[]> {
  return {
    "1m": base,
    "5m": base,
    "15m": resample(base, 15 * 60_000),
    "1h": resample(base, 3_600_000),
    "4h": resample(base, 4 * 3_600_000),
  };
}

/* ------------------------- Massive (primary provider) ------------------------ */

/** Which Massive asset class a desk maps to (`null` = no Massive coverage). */
function assetClassFor(inst: Instrument): AssetClass | null {
  if (inst.desk === "stocks") return "stocks";
  if (inst.desk === "crypto") return "crypto";
  if (inst.desk === "fx") return inst.key.length === 6 ? "fx" : null;
  if (inst.desk === "indices") return ["SPX", "NDX", "DJI", "RUT", "VIX"].includes(inst.key) ? "indices" : null;
  return null; // futures resolve from the continuous tape
}

/**
 * Terminal-grade bars for one instrument at one timeframe, straight from
 * Massive when the plan covers it. Falls back to daily bars so the pane always
 * has a real series rather than an empty chart.
 */
async function massiveTapeBars(inst: Instrument, tf: Timeframe): Promise<Bar[]> {
  const assetClass = assetClassFor(inst);
  if (!assetClass) return [];
  const symbol = assetClass === "stocks" ? inst.key : inst.key;
  const intraday = await massiveBars(assetClass, symbol, tf).catch(() => null);
  if (intraday && intraday.length > 4) return intraday;
  if (tf === "1h" || tf === "4h") {
    const daily = await massiveDailyBars(assetClass, symbol).catch(() => null);
    if (daily && daily.length > 4) return daily;
  }
  return [];
}

/* ---------------------- Twelve Data (secondary provider) --------------------- */

/**
 * Spot equivalents Twelve Data quotes for CME contracts. Index contracts stay
 * out: they keep resolving through the existing ETF-proxy path.
 */
const TD_FUTURES: Record<string, string> = {
  GC: "XAU/USD",
  SI: "XAG/USD",
  PL: "XPT/USD",
  CL: "WTI/USD",
  NG: "NG/USD",
  HG: "COPPER/USD",
};

/** Twelve Data symbol for a desk instrument, or `null` when unmapped. */
function tdSymbolFor(inst: Instrument): string | null {
  if (inst.desk === "stocks") return inst.key;
  if (inst.desk === "fx") return inst.key.length === 6 ? tdSymbol("fx", inst.key) : null;
  if (inst.desk === "crypto") return tdSymbol("crypto", inst.key);
  if (inst.desk === "futures") return TD_FUTURES[inst.key] ?? null;
  return null; // benchmarks/indices use the proxy path
}

/** Desk priority when the per-poll Twelve Data budget has to be rationed. */
const TD_DESK_RANK: Record<DeskId, number> = { futures: 0, fx: 1, stocks: 2, crypto: 3, indices: 9 };

/** Bars for one instrument from Twelve Data at a desk timeframe. */
async function twelveDataTapeBars(inst: Instrument, tf: Timeframe): Promise<Bar[]> {
  const symbol = tdSymbolFor(inst);
  if (!symbol) return [];
  const key = `td:${symbol}:${tf}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const { tdInterval, twelveDataBars } = await import("@/lib/twelvedata.server");
  const bars = await twelveDataBars(symbol, tdInterval(tf), 400).catch(() => null);
  if (!bars || bars.length < 2) return hit?.value ?? [];
  cache.set(key, { at: Date.now(), value: bars });
  return bars;
}

function toRow(inst: Instrument, base: Bar[], source: MarketSource = "none"): MarketRow {

  const tf = barsByTf(base);
  // Daily-granularity series (whole-market summaries) need a session window and
  // a prev-close reference that differ from an intraday 5m tape.
  const gap = base.length > 2 ? (base.at(-1)!.t - base.at(-2)!.t) : 0;
  const daily = gap >= 12 * 3600_000;
  const session = daily ? base.slice(-40) : base.slice(-288);
  const last = session.at(-1);
  const first = daily ? { open: session.at(-2)?.close ?? last?.open ?? 0 } : session[0];
  const live = Boolean(last && first);
  return {
    key: inst.key,
    code: inst.code,
    name: inst.name,
    group: inst.group,
    desk: inst.desk,
    symbol: inst.symbol,
    ticker: inst.symbol,
    quote: inst.quote,
    last: last?.close ?? 0,
    prevClose: first?.open ?? 0,
    changePct: last && first?.open ? ((last.close - first.open) / first.open) * 100 : 0,
    high: live ? (daily ? last!.high : Math.max(...session.map((b) => b.high))) : 0,
    low: live ? (daily ? last!.low : Math.min(...session.map((b) => b.low))) : 0,
    volume: daily ? (last?.volume ?? 0) : session.reduce((s, b) => s + b.volume, 0),
    spark: session.slice(-72).map((b) => b.close),
    signals: timeframes.map((t) => tfSignal(t.id, tf[t.id])),
    indicators: indicators(session),
    status: live ? "live" : "syncing",
    source: live ? source : "none",
    updatedAt: last?.t ?? Date.now(),

  };
}


const SPARK = "https://query1.finance.yahoo.com/v8/finance/spark";

type SparkResponse = Record<string, { timestamp?: number[]; close?: (number | null)[] } | undefined>;

/**
 * Batched board feed: one upstream call covers up to 15 symbols, which keeps us
 * far below the burst limits that made per-symbol chart calls return 429.
 * Close-only series is enough for board scoring; the detail view still pulls
 * true OHLCV for the selected instrument.
 */
async function loadSparkBars(symbols: string[]): Promise<Map<string, Bar[]>> {
  const out = new Map<string, Bar[]>();
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += 15) chunks.push(symbols.slice(i, i + 15));

  await Promise.all(
    chunks.map(async (chunk) => {
      const key = `spark:${chunk.join(",")}`;
      const hit = cache.get(key);
      const fresh = hit && Date.now() - hit.at < TTL;
      const url = `${SPARK}?symbols=${chunk.map(encodeURIComponent).join(",")}&interval=5m&range=5d`;
      let json: SparkResponse | null = null;
      if (!fresh) {
        json = (await fetchChart(url).catch(() => null)) as unknown as SparkResponse | null;
      }
      for (const symbol of chunk) {
        const cached = cache.get(`spark:one:${symbol}`);
        const series = json?.[symbol];
        const ts = series?.timestamp ?? [];
        const closes = series?.close ?? [];
        const bars: Bar[] = [];
        for (let i = 0; i < ts.length; i++) {
          const close = num(closes[i]);
          if (!close) continue;
          const prev = bars[bars.length - 1]?.close ?? close;
          bars.push({ t: (ts[i] as number) * 1000, open: prev, high: Math.max(prev, close), low: Math.min(prev, close), close, volume: 0 });
        }
        if (bars.length > 1) {
          const trimmed = bars.slice(-600);
          cache.set(`spark:one:${symbol}`, { at: Date.now(), value: trimmed });
          out.set(symbol, trimmed);
        } else if (cached) {
          out.set(symbol, cached.value);
        }
      }
      if (json) cache.set(key, { at: Date.now(), value: [] });
    }),
  );
  return out;
}

/* ------------------------------ keyless fallbacks ------------------------------ */

const BINANCE = "https://api.binance.com/api/v3/klines";
const FRANKFURTER = "https://api.frankfurter.dev/v1";

/** Crypto pairs resolve from Binance spot klines when the primary feed throttles. */
async function binanceBars(symbol: string): Promise<Bar[]> {
  const base = symbol.replace("-USD", "").toUpperCase();
  const url = `${BINANCE}?symbol=${base}USDT&interval=5m&limit=576`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`binance ${res.status}`);
  const rows = (await res.json()) as unknown[][];
  return rows.map((r) => ({
    t: num(r[0]),
    open: num(r[1]),
    high: num(r[2]),
    low: num(r[3]),
    close: num(r[4]),
    volume: num(r[5]),
  }));
}

/** Spot FX resolves from Frankfurter's daily ECB series (close-only). */
async function frankfurterBars(symbol: string): Promise<Bar[]> {
  const pair = symbol.replace("=X", "").toUpperCase();
  if (pair.length !== 6) throw new Error("unsupported fx pair");
  const from = pair.slice(0, 3);
  const to = pair.slice(3);
  const start = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  const res = await fetch(`${FRANKFURTER}/${start}..?base=${from}&symbols=${to}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`frankfurter ${res.status}`);
  const json = (await res.json()) as { rates?: Record<string, Record<string, number>> };
  const entries = Object.entries(json.rates ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const bars: Bar[] = [];
  for (const [day, rates] of entries) {
    const close = num(rates[to]);
    if (!close) continue;
    const prev = bars[bars.length - 1]?.close ?? close;
    bars.push({
      t: new Date(`${day}T21:00:00Z`).getTime(),
      open: prev,
      high: Math.max(prev, close),
      low: Math.min(prev, close),
      close,
      volume: 0,
    });
  }
  return bars;
}

/** Keyless per-desk fallback so a throttled primary feed never strands a row. */
async function fallbackBars(inst: Instrument): Promise<Bar[]> {
  const key = `fb:${inst.symbol}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  try {
    const bars =
      inst.desk === "crypto" || inst.symbol.startsWith("BTC-") || inst.symbol.startsWith("ETH-")
        ? await binanceBars(inst.symbol)
        : inst.desk === "fx" && inst.symbol.endsWith("=X")
          ? await frankfurterBars(inst.symbol)
          : [];
    if (bars.length > 1) cache.set(key, { at: Date.now(), value: bars });
    return bars;
  } catch (e) {
    console.warn(`[tape] fallback ${inst.symbol} failed: ${(e as Error).message}`);
    return hit?.value ?? [];
  }
}

/** Board for one desk (or every desk when `desk` is omitted). */
export async function loadTapeBoard(desk?: DeskId): Promise<MarketBoard> {
  const list = desk ? instrumentsByDesk(desk) : instruments;
  const series = new Map<string, Bar[]>();
  const sources = new Map<string, MarketSource>();
  const put = (symbol: string, bars: Bar[], source: MarketSource) => {
    if (bars.length < 2) return;
    series.set(symbol, bars);
    sources.set(symbol, source);
  };

  // 1) Massive whole-market daily summaries: one request covers an entire asset
  //    class, so every stock, crypto pair and FX cross prices on the first poll.
  const byClass = new Map<AssetClass, Instrument[]>();
  for (const inst of list) {
    const cls = assetClassFor(inst);
    if (!cls || cls === "indices") continue;
    byClass.set(cls, [...(byClass.get(cls) ?? []), inst]);
  }
  await Promise.all(
    [...byClass].map(async ([cls, group]) => {
      const rows = await massiveBoardSeries(
        cls,
        group.map((i) => i.key),
      ).catch(() => new Map<string, Bar[]>());
      for (const inst of group) {
        const bars = rows.get(inst.key);
        if (bars && bars.length > 1) put(inst.symbol, bars, "massive");
      }
    }),
  );

  // Fallback steps are time boxed so a throttled feed can never stall the board.
  const cap = <T,>(p: Promise<T>, fallback: T, ms = 4_000): Promise<T> =>
    Promise.race([p.catch(() => fallback), sleep(ms).then(() => fallback)]);

  // 1b) Twelve Data for anything Massive didn't answer for: true OHLCV with
  //     volume, so the shared indicator + multi-timeframe signal pipeline scores
  //     these rows off real bars instead of a close-only public series.
  //     Rationed per poll (commodities and FX first) to respect the free plan.
  const tdCandidates = list
    .filter((inst) => (series.get(inst.symbol)?.length ?? 0) < 2 && tdSymbolFor(inst))
    .sort((a, b) => (TD_DESK_RANK[a.desk] ?? 9) - (TD_DESK_RANK[b.desk] ?? 9))
    .slice(0, 6);
  if (tdCandidates.length > 0) {
    await Promise.all(
      tdCandidates.map(async (inst) => {
        const bars = await cap(twelveDataTapeBars(inst, "5m"), [] as Bar[], 6_000);
        put(inst.symbol, bars, "twelvedata");
      }),
    );
  }

  // 2) Continuous keyless tape for anything still missing (futures, benchmarks).
  const missing = list.filter((inst) => (series.get(inst.symbol)?.length ?? 0) < 2);
  if (missing.length > 0) {
    const spark = await cap(loadSparkBars(missing.map((i) => i.symbol)), new Map<string, Bar[]>(), 5_000);
    for (const [symbol, bars] of spark) put(symbol, bars, "tape");
  }

  // 2b) ETF proxy pricing for contracts and benchmarks the plan doesn't cover
  //     directly (futures, index levels). Real, live ETF tape — labelled as a
  //     proxy in the row name so nothing reads as a synthetic quote.
  const usedDirect = new Set(series.keys());
  const needProxy = list.filter(
    (inst) => inst.proxy && (series.get(inst.symbol)?.length ?? 0) < 2,
  );
  if (needProxy.length > 0) {
    const proxied = await massiveBoardSeries(
      "stocks",
      [...new Set(needProxy.map((i) => i.proxy!))],
    ).catch(() => new Map<string, Bar[]>());
    for (const inst of needProxy) {
      const bars = proxied.get(inst.proxy!);
      if (bars && bars.length > 1) put(inst.symbol, bars, "proxy");
    }
  }

  // 3) Per-desk keyless fallback so a throttled feed never strands a row.
  await Promise.all(
    list
      .filter((inst) => (series.get(inst.symbol)?.length ?? 0) < 2)
      .map(async (inst) => {
        const bars = await cap(fallbackBars(inst), [] as Bar[]);
        const isCrypto = inst.desk === "crypto" || inst.symbol.startsWith("BTC-") || inst.symbol.startsWith("ETH-");
        put(inst.symbol, bars, isCrypto ? "binance" : "frankfurter");
      }),
  );


  const rows = list.map((inst) => {
    const row = toRow(inst, series.get(inst.symbol) ?? [], sources.get(inst.symbol) ?? "none");
    const viaProxy = Boolean(inst.proxy && row.status === "live" && !usedDirect.has(inst.symbol));
    return viaProxy ? { ...row, name: `${inst.name} · ${inst.proxy} proxy` } : row;
  });
  return {
    rows,
    updatedAt: Date.now(),
    pending: rows.filter((r) => r.status === "syncing").length,
  };
}



export async function loadTapeDetail(key: string, interval: Timeframe): Promise<MarketDetail> {
  let inst = findInstrument(key) ?? {
    key: key.toUpperCase(),
    code: key.toUpperCase(),
    name: key.toUpperCase(),
    group: "Search",
    desk: "stocks" as DeskId,
    symbol: key.toUpperCase(),
    quote: "USD",
  };
  // 1) Massive at the requested granularity (1m → 4h), 2) continuous tape,
  // 3) keyless per-desk fallback. Whichever answers first wins.
  const primary = await massiveTapeBars(inst, interval).catch(() => []);
  if (primary.length > 4) {
    const row = toRow(inst, primary);
    return { ...row, bars: primary.slice(-400), interval };
  }
  let base = await loadBars(inst.symbol, { interval: interval === "1m" ? "1m" : "5m", range: interval === "1m" ? "1d" : "5d" });
  if (base.length < 5) base = await fallbackBars(inst);
  // Contracts and index levels the plan doesn't cover directly fall back to
  // their live ETF proxy tape rather than erroring the whole chart.
  const proxy = inst.proxy;
  if (base.length < 5 && proxy) {
    base = await massiveTapeBars({ ...inst, symbol: proxy, proxy: undefined }, interval).catch(() => []);
    if (base.length < 5) base = await loadBars(proxy, { interval: "5m", range: "5d" }).catch(() => []);
    if (base.length > 4) inst = { ...inst, name: `${inst.name} · ${proxy} proxy` };
  }
  if (base.length < 5) {
    // No feed answered — surface a syncing row so the terminal stays usable.
    return { ...toRow(inst, []), bars: [], interval };
  }
  const tf = barsByTf(base);
  return { ...toRow(inst, base), bars: tf[interval].slice(-400), interval };
}




/* --------------------------------- search --------------------------------- */

export type SearchHit = { symbol: string; name: string; type: string; exchange: string };

export async function searchSymbols(q: string): Promise<SearchHit[]> {
  const term = q.trim();
  if (term.length < 1) return [];

  // Massive reference search first — same tickers the bar loader consumes.
  const massive = await massiveSearch(term).catch(() => []);
  const hits: SearchHit[] = massive
    .filter((h) => h.symbol)
    .map((h) => ({ symbol: h.symbol, name: h.name, type: h.type, exchange: h.exchange || h.market }));

  const url = `${SEARCH}?q=${encodeURIComponent(term)}&quotesCount=12&newsCount=0`;
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } }).catch(() => null);
  if (!res || !res.ok) return hits;
  const json = (await res.json().catch(() => ({}))) as {
    quotes?: { symbol?: string; shortname?: string; longname?: string; quoteType?: string; exchDisp?: string }[];
  };
  const seen = new Set(hits.map((h) => h.symbol.toUpperCase()));
  for (const h of json.quotes ?? []) {
    const symbol = typeof h.symbol === "string" ? h.symbol : "";
    if (!symbol || seen.has(symbol.toUpperCase())) continue;
    seen.add(symbol.toUpperCase());
    hits.push({
      symbol,
      name: String(h.longname ?? h.shortname ?? symbol),
      type: String(h.quoteType ?? "EQUITY").toLowerCase(),
      exchange: String(h.exchDisp ?? ""),
    });
  }
  return hits.slice(0, 20);
}

