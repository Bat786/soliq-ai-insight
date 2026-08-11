/** Futures & benchmark desk data (server only) — sourced from Unusual Whales tape. */

const BASE = "https://api.unusualwhales.com";

export type Bar = {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Timeframe = "1m" | "5m" | "15m" | "1h";
export const timeframes: { id: Timeframe; label: string; ms: number }[] = [
  { id: "1m", label: "1m", ms: 60_000 },
  { id: "5m", label: "5m", ms: 5 * 60_000 },
  { id: "15m", label: "15m", ms: 15 * 60_000 },
  { id: "1h", label: "1H", ms: 3_600_000 },
];

export type TfSignal = {
  tf: Timeframe;
  bull: number;
  bear: number;
  tilt: number;
  confidence: number;
  label: string;
  changePct: number;
  volume: number;
  upVolumeShare: number;
  atrPct: number;
};

export type Contract = {
  code: string;
  name: string;
  group: string;
  proxy: string;
  unit: string;
};

export type FuturesQuote = {
  contract: Contract;
  last: number;
  prevClose: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
  totalVolume: number;
  marketTime: string;
  tapeTime: number;
  optionsTilt: number;
  netOptionPremium: number;
  signals: TfSignal[];
  spark: number[];
};

export type FuturesBoard = { quotes: FuturesQuote[]; updatedAt: number };

export type TickerDetail = {
  symbol: string;
  fullName: string;
  issueType: string;
  sector: string | null;
  logo: string | null;
  last: number;
  prevClose: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
  totalVolume: number;
  marketTime: string;
  tapeTime: number;
  optionsTilt: number;
  netOptionPremium: number;
  callVolume: number;
  putVolume: number;
  signals: TfSignal[];
  bars: Bar[];
  interval: Timeframe;
};

export const contracts: Contract[] = [
  { code: "ES", name: "E-mini S&P 500", group: "Equity index", proxy: "SPY", unit: "index" },
  { code: "NQ", name: "E-mini Nasdaq-100", group: "Equity index", proxy: "QQQ", unit: "index" },
  { code: "RTY", name: "E-mini Russell 2000", group: "Equity index", proxy: "IWM", unit: "index" },
  { code: "YM", name: "E-mini Dow", group: "Equity index", proxy: "DIA", unit: "index" },
  { code: "CL", name: "Crude Oil (WTI)", group: "Energy", proxy: "USO", unit: "bbl" },
  { code: "NG", name: "Natural Gas", group: "Energy", proxy: "UNG", unit: "mmBtu" },
  { code: "GC", name: "Gold", group: "Metals", proxy: "GLD", unit: "oz" },
  { code: "SI", name: "Silver", group: "Metals", proxy: "SLV", unit: "oz" },
  { code: "HG", name: "Copper", group: "Metals", proxy: "CPER", unit: "lb" },
  { code: "BTC", name: "Bitcoin", group: "Crypto", proxy: "IBIT", unit: "BTC" },
  { code: "ETH", name: "Ether", group: "Crypto", proxy: "ETHA", unit: "ETH" },
];

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const ms = (v: unknown): number => {
  if (typeof v === "number") return v > 1e12 ? v : v * 1000;
  const t = Date.parse(String(v ?? ""));
  return Number.isFinite(t) ? t : Date.now();
};

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();
const TTL = 30_000;
const sleep = (n: number) => new Promise((r) => setTimeout(r, n));

async function uw<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
  const key = process.env["UNUSUAL_WHALES_API_KEY"];
  if (!key) throw new Error("Unusual Whales API key is not configured");

  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  const cacheKey = url.toString();

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;

  // Upstream throttles bursts, so retry transient rate-limit/5xx responses.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(cacheKey, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (res.ok) break;
    if (res.status !== 429 && res.status < 500) break;
    await sleep(350 * (attempt + 1));
  }
  if (!res || !res.ok) {
    if (hit) return hit.value as T;
    throw new Error(`Unusual Whales ${path} failed [${res?.status ?? 0}]`);
  }

  const json = (await res.json()) as { data?: T };
  const value = (json.data ?? ([] as unknown)) as T;
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

function parseBars(rows: Record<string, unknown>[]): Bar[] {
  return rows
    .map((r) => ({
      t: ms(r["start_time"]),
      open: num(r["open"]),
      high: num(r["high"]),
      low: num(r["low"]),
      close: num(r["close"]),
      volume: num(r["volume"]),
    }))
    .filter((b) => b.close > 0)
    .sort((a, b) => a.t - b.t);
}

/** Roll finer bars up onto a coarser time grid. */
export function resample(bars: Bar[], size: number): Bar[] {
  const buckets = new Map<number, Bar>();
  for (const b of bars) {
    const key = Math.floor(b.t / size) * size;
    const cur = buckets.get(key);
    if (!cur) {
      buckets.set(key, { ...b, t: key });
    } else {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume += b.volume;
    }
  }
  return [...buckets.values()].sort((a, b) => a.t - b.t);
}

function ema(values: number[], span: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (span + 1);
  let e = values[0] as number;
  for (const v of values.slice(1)) e = v * k + e * (1 - k);
  return e;
}

/** Momentum + participation blended into a 0-100 bull/bear reading for one timeframe. */
export function tfSignal(tf: Timeframe, bars: Bar[], optionsTilt = 0): TfSignal {
  const window = bars.slice(-40);
  const first = window[0];
  const last = window.at(-1);
  if (!first || !last || window.length < 3) {
    return {
      tf,
      bull: 50,
      bear: 50,
      tilt: 0,
      confidence: 35,
      label: "No tape",
      changePct: 0,
      volume: 0,
      upVolumeShare: 0.5,
      atrPct: 0,
    };
  }

  const closes = window.map((b) => b.close);
  const changePct = ((last.close - first.open) / (first.open || 1)) * 100;
  const atrPct =
    (window.reduce((s, b) => s + (b.high - b.low), 0) / window.length / (last.close || 1)) * 100;

  const volume = window.reduce((s, b) => s + b.volume, 0);
  const upVol = window.reduce((s, b) => s + (b.close >= b.open ? b.volume : 0), 0);
  const upVolumeShare = volume > 0 ? upVol / volume : 0.5;

  const trend = ema(closes, 8) - ema(closes, 21);
  const momentumTilt = Math.tanh(changePct / Math.max(0.12, atrPct * 2.2));
  const trendTilt = Math.tanh((trend / (last.close || 1)) * 320);
  const flowTilt = Math.tanh((upVolumeShare - 0.5) * 5);

  const tilt = Math.max(
    -1,
    Math.min(1, momentumTilt * 0.4 + trendTilt * 0.28 + flowTilt * 0.2 + optionsTilt * 0.12),
  );
  const bull = Math.round(50 + tilt * 50);
  const label =
    tilt > 0.35 ? "Strong bullish"
    : tilt > 0.12 ? "Bullish"
    : tilt < -0.35 ? "Strong bearish"
    : tilt < -0.12 ? "Bearish"
    : "Neutral";
  const depth = Math.min(1, window.length / 30);

  return {
    tf,
    bull,
    bear: 100 - bull,
    tilt,
    confidence: Math.round(Math.min(95, 42 + Math.abs(tilt) * 42 * depth + depth * 11)),
    label,
    changePct,
    volume,
    upVolumeShare,
    atrPct,
  };
}

type State = {
  close: number;
  prevClose: number;
  high: number;
  low: number;
  volume: number;
  totalVolume: number;
  marketTime: string;
  tapeTime: number;
};

async function loadState(symbol: string): Promise<State> {
  const raw = await uw<Record<string, unknown>>(`/api/stock/${symbol}/stock-state`).catch(() => ({}) as Record<string, unknown>);
  return {
    close: num(raw["close"]),
    prevClose: num(raw["prev_close"]),
    high: num(raw["high"]),
    low: num(raw["low"]),
    volume: num(raw["volume"]),
    totalVolume: num(raw["total_volume"]),
    marketTime: String(raw["market_time"] ?? "closed"),
    tapeTime: ms(raw["tape_time"]),
  };
}

async function loadOptionTilt(symbol: string) {
  const rows = await uw<Record<string, unknown>[]>(`/api/stock/${symbol}/net-prem-ticks`).catch(
    () => [] as Record<string, unknown>[],
  );
  let callPrem = 0;
  let putPrem = 0;
  let callVolume = 0;
  let putVolume = 0;
  for (const r of rows) {
    callPrem += num(r["net_call_premium"]);
    putPrem += num(r["net_put_premium"]);
    callVolume += num(r["call_volume"]);
    putVolume += num(r["put_volume"]);
  }
  const net = callPrem - putPrem;
  const gross = Math.abs(callPrem) + Math.abs(putPrem) || 1;
  return {
    tilt: Math.tanh(net / Math.max(1e6, gross * 0.6)),
    netOptionPremium: net,
    callVolume,
    putVolume,
  };
}

async function loadBars(symbol: string) {
  const [fine, coarse] = await Promise.all([
    uw<Record<string, unknown>[]>(`/api/stock/${symbol}/ohlc/1m`, { limit: 180 }).catch(
      () => [] as Record<string, unknown>[],
    ),
    uw<Record<string, unknown>[]>(`/api/stock/${symbol}/ohlc/5m`, { limit: 400 }).catch(
      () => [] as Record<string, unknown>[],
    ),
  ]);
  const m1 = parseBars(fine);
  const m5 = parseBars(coarse);
  return {
    "1m": m1.length > 3 ? m1 : m5,
    "5m": m5.length > 3 ? m5 : m1,
    "15m": resample(m5.length > 3 ? m5 : m1, 15 * 60_000),
    "1h": resample(m5.length > 3 ? m5 : m1, 3_600_000),
  } satisfies Record<Timeframe, Bar[]>;
}

export async function loadContractQuote(contract: Contract): Promise<FuturesQuote> {
  const state = await loadState(contract.proxy);
  const [options, bars] = await Promise.all([loadOptionTilt(contract.proxy), loadBars(contract.proxy)]);

  const signals = timeframes.map((t) => tfSignal(t.id, bars[t.id], options.tilt));
  const spark = bars["5m"].slice(-60).map((b) => b.close);

  return {
    contract,
    last: state.close,
    prevClose: state.prevClose,
    changePct: state.prevClose ? ((state.close - state.prevClose) / state.prevClose) * 100 : 0,
    high: state.high,
    low: state.low,
    volume: state.volume,
    totalVolume: state.totalVolume,
    marketTime: state.marketTime,
    tapeTime: state.tapeTime,
    optionsTilt: options.tilt,
    netOptionPremium: options.netOptionPremium,
    signals,
    spark,
  };
}

export async function loadFuturesBoard(): Promise<FuturesBoard> {
  const quotes: FuturesQuote[] = [];
  // Sequential-in-chunks keeps us inside the upstream rate limit.
  for (let i = 0; i < contracts.length; i += 2) {
    if (i > 0) await sleep(120);
    const chunk = contracts.slice(i, i + 2);
    const done = await Promise.all(
      chunk.map((c) =>
        loadContractQuote(c).catch(
          (): FuturesQuote => ({
            contract: c,
            last: 0,
            prevClose: 0,
            changePct: 0,
            high: 0,
            low: 0,
            volume: 0,
            totalVolume: 0,
            marketTime: "unavailable",
            tapeTime: Date.now(),
            optionsTilt: 0,
            netOptionPremium: 0,
            signals: timeframes.map((t) => tfSignal(t.id, [])),
            spark: [],
          }),
        ),
      ),
    );
    quotes.push(...done);
  }
  return { quotes, updatedAt: Date.now() };
}

export async function loadTickerDetail(symbolRaw: string, interval: Timeframe): Promise<TickerDetail> {
  const symbol = symbolRaw.trim().toUpperCase().replace(/[^A-Z.:-]/g, "");
  if (!symbol) throw new Error("Enter a ticker symbol");

  const info = await uw<Record<string, unknown>>(`/api/stock/${symbol}/info`).catch(() => null);
  if (!info || !info["symbol"]) throw new Error(`No market data found for “${symbol}”`);

  const [state, options, bars] = await Promise.all([
    loadState(symbol),
    loadOptionTilt(symbol),
    loadBars(symbol),
  ]);

  return {
    symbol,
    fullName: String(info["full_name"] ?? symbol),
    issueType: String(info["issue_type"] ?? "equity"),
    sector: (info["sector"] as string | null) ?? null,
    logo: (info["logo"] as string | null) ?? null,
    last: state.close,
    prevClose: state.prevClose,
    changePct: state.prevClose ? ((state.close - state.prevClose) / state.prevClose) * 100 : 0,
    high: state.high,
    low: state.low,
    volume: state.volume,
    totalVolume: state.totalVolume,
    marketTime: state.marketTime,
    tapeTime: state.tapeTime,
    optionsTilt: options.tilt,
    netOptionPremium: options.netOptionPremium,
    callVolume: options.callVolume,
    putVolume: options.putVolume,
    signals: timeframes.map((t) => tfSignal(t.id, bars[t.id], options.tilt)),
    bars: bars[interval].slice(-320),
    interval,
  };
}
