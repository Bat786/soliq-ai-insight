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
const MIN_GAP = 1500;
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function queued<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = MIN_GAP - (Date.now() - lastAt);
    if (wait > 0) await sleep(wait);
    lastAt = Date.now();
    return task();
  });
  chain = run.catch(() => undefined);
  return run;
}

async function fetchChart(url: string): Promise<ChartResponse | null> {
  const backoff = [0, 4000];
  for (const wait of backoff) {
    if (wait) await sleep(wait);
    try {
      const res = await queued(() => fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } }));
      if (res.ok) return (await res.json()) as ChartResponse;
      console.warn(`[tape] ${url} -> ${res.status}`);
      if (res.status !== 429 && res.status !== 503) return null;
    } catch (e) {
      console.warn(`[tape] ${url} threw ${(e as Error).message}`);
      return null;
    }
  }
  return null;
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
  };
}

function toRow(inst: Instrument, base: Bar[]): MarketRow {
  const tf = barsByTf(base);
  const session = base.slice(-288);
  const last = session.at(-1);
  const first = session[0];
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
    high: live ? Math.max(...session.map((b) => b.high)) : 0,
    low: live ? Math.min(...session.map((b) => b.low)) : 0,
    volume: session.reduce((s, b) => s + b.volume, 0),
    spark: session.slice(-72).map((b) => b.close),
    signals: timeframes.map((t) => tfSignal(t.id, tf[t.id])),
    indicators: indicators(session),
    status: live ? "live" : "syncing",
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

/** Board for one desk (or every desk when `desk` is omitted). */
export async function loadTapeBoard(desk?: DeskId): Promise<MarketBoard> {
  const list = desk ? instrumentsByDesk(desk) : instruments;
  const series = await loadSparkBars(list.map((i) => i.symbol)).catch(() => new Map<string, Bar[]>());
  const rows = list.map((inst) => toRow(inst, series.get(inst.symbol) ?? []));
  return {
    rows,
    updatedAt: Date.now(),
    pending: rows.filter((r) => r.status === "syncing").length,
  };
}

export async function loadTapeDetail(key: string, interval: Timeframe): Promise<MarketDetail> {
  const inst = findInstrument(key) ?? {
    key: key.toUpperCase(),
    code: key.toUpperCase(),
    name: key.toUpperCase(),
    group: "Search",
    desk: "stocks" as DeskId,
    symbol: key.toUpperCase(),
    quote: "USD",
  };
  const base = await loadBars(inst.symbol);
  if (base.length < 5) throw new Error(`No tape available for “${inst.code}”`);
  const tf = barsByTf(base);
  return { ...toRow(inst, base), bars: tf[interval].slice(-320), interval };
}

/* --------------------------------- search --------------------------------- */

export type SearchHit = { symbol: string; name: string; type: string; exchange: string };

export async function searchSymbols(q: string): Promise<SearchHit[]> {
  const term = q.trim();
  if (term.length < 1) return [];
  const url = `${SEARCH}?q=${encodeURIComponent(term)}&quotesCount=12&newsCount=0`;
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    quotes?: { symbol?: string; shortname?: string; longname?: string; quoteType?: string; exchDisp?: string }[];
  };
  return (json.quotes ?? [])
    .filter((h) => typeof h.symbol === "string")
    .map((h) => ({
      symbol: String(h.symbol),
      name: String(h.longname ?? h.shortname ?? h.symbol),
      type: String(h.quoteType ?? "EQUITY").toLowerCase(),
      exchange: String(h.exchDisp ?? ""),
    }));
}
