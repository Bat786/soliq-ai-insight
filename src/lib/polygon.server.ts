/** Polygon.io 24/7 FX + crypto tape and shared technical indicators (server only). */

import { resample, tfSignal, timeframes, type Bar, type TfSignal, type Timeframe } from "@/lib/futures.server";

const BASE = "https://api.polygon.io";

export type Indicators = {
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  vwap: number;
  ema20: number;
  ema50: number;
  atrPct: number;
  verdict: "buy" | "sell" | "hold";
  score: number;
};

export type MarketRow = {
  key: string;
  code: string;
  name: string;
  group: string;
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

export type Instrument = { key: string; code: string; name: string; group: string; ticker: string; quote: string };

export const fxInstruments: Instrument[] = [
  { key: "EURUSD", code: "EUR/USD", name: "Euro · US Dollar", group: "Forex majors", ticker: "C:EURUSD", quote: "USD" },
  { key: "GBPUSD", code: "GBP/USD", name: "Sterling · US Dollar", group: "Forex majors", ticker: "C:GBPUSD", quote: "USD" },
  { key: "USDJPY", code: "USD/JPY", name: "US Dollar · Yen", group: "Forex majors", ticker: "C:USDJPY", quote: "JPY" },
  { key: "USDCHF", code: "USD/CHF", name: "US Dollar · Swiss Franc", group: "Forex majors", ticker: "C:USDCHF", quote: "CHF" },
  { key: "AUDUSD", code: "AUD/USD", name: "Aussie · US Dollar", group: "Forex majors", ticker: "C:AUDUSD", quote: "USD" },
  { key: "USDCAD", code: "USD/CAD", name: "US Dollar · Loonie", group: "Forex majors", ticker: "C:USDCAD", quote: "CAD" },
  { key: "NZDUSD", code: "NZD/USD", name: "Kiwi · US Dollar", group: "Forex majors", ticker: "C:NZDUSD", quote: "USD" },
  { key: "EURJPY", code: "EUR/JPY", name: "Euro · Yen", group: "Forex crosses", ticker: "C:EURJPY", quote: "JPY" },
  { key: "GBPJPY", code: "GBP/JPY", name: "Sterling · Yen", group: "Forex crosses", ticker: "C:GBPJPY", quote: "JPY" },
  { key: "EURGBP", code: "EUR/GBP", name: "Euro · Sterling", group: "Forex crosses", ticker: "C:EURGBP", quote: "GBP" },
];

export const cryptoInstruments: Instrument[] = [
  { key: "BTCUSD", code: "BTC/USD", name: "Bitcoin", group: "Crypto 24/7", ticker: "X:BTCUSD", quote: "USD" },
  { key: "ETHUSD", code: "ETH/USD", name: "Ether", group: "Crypto 24/7", ticker: "X:ETHUSD", quote: "USD" },
  { key: "SOLUSD", code: "SOL/USD", name: "Solana", group: "Crypto 24/7", ticker: "X:SOLUSD", quote: "USD" },
  { key: "XRPUSD", code: "XRP/USD", name: "XRP", group: "Crypto 24/7", ticker: "X:XRPUSD", quote: "USD" },
];

export const instruments: Instrument[] = [...fxInstruments, ...cryptoInstruments];

export function findInstrument(key: string): Instrument | undefined {
  const k = key.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return instruments.find((i) => i.key === k);
}

/* ------------------------------- indicators ------------------------------- */

function emaSeries(values: number[], span: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (span + 1);
  const out: number[] = [values[0] as number];
  for (let i = 1; i < values.length; i++) out.push((values[i] as number) * k + (out[i - 1] as number) * (1 - k));
  return out;
}

function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const d = (values[i] as number) - (values[i - 1] as number);
    if (d >= 0) gain += d;
    else loss -= d;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

export function indicators(bars: Bar[]): Indicators {
  const closes = bars.map((b) => b.close);
  const last = closes.at(-1) ?? 0;
  if (closes.length < 5) {
    return { rsi14: 50, macd: 0, macdSignal: 0, macdHist: 0, vwap: last, ema20: last, ema50: last, atrPct: 0, verdict: "hold", score: 50 };
  }

  const fast = emaSeries(closes, 12);
  const slow = emaSeries(closes, 26);
  const macdLine = closes.map((_, i) => (fast[i] as number) - (slow[i] as number));
  const signalLine = emaSeries(macdLine, 9);
  const macd = macdLine.at(-1) as number;
  const macdSignal = signalLine.at(-1) as number;
  const macdHist = macd - macdSignal;

  const pv = bars.reduce((s, b) => s + ((b.high + b.low + b.close) / 3) * (b.volume || 1), 0);
  const vol = bars.reduce((s, b) => s + (b.volume || 1), 0);
  const vwap = vol > 0 ? pv / vol : last;

  const ema20 = emaSeries(closes, 20).at(-1) as number;
  const ema50 = emaSeries(closes, 50).at(-1) as number;
  const rsi14 = rsi(closes);
  const atrPct = (bars.slice(-40).reduce((s, b) => s + (b.high - b.low), 0) / Math.min(40, bars.length) / (last || 1)) * 100;

  let score = 50;
  score += Math.max(-18, Math.min(18, (macdHist / (last || 1)) * 4200));
  score += Math.max(-14, Math.min(14, (rsi14 - 50) * 0.45));
  score += last > vwap ? 9 : -9;
  score += ema20 > ema50 ? 9 : -9;
  score = Math.max(2, Math.min(98, Math.round(score)));

  return {
    rsi14,
    macd,
    macdSignal,
    macdHist,
    vwap,
    ema20,
    ema50,
    atrPct,
    verdict: score >= 62 ? "buy" : score <= 38 ? "sell" : "hold",
    score,
  };
}

/* ------------------------------ polygon fetch ----------------------------- */

type CacheEntry = { at: number; value: Bar[] };
const cache = new Map<string, CacheEntry>();
const TTL = 5 * 60_000;

// Free-tier keys allow a handful of calls per minute, so meter every request.
const budget = { window: 0, used: 0 };
const LIMIT = 4;

function takeToken(): boolean {
  const now = Math.floor(Date.now() / 60_000);
  if (budget.window !== now) {
    budget.window = now;
    budget.used = 0;
  }
  if (budget.used >= LIMIT) return false;
  budget.used += 1;
  return true;
}

function apiKey(): string {
  const raw = process.env["POLYGON_API_KEY"];
  if (!raw) throw new Error("Polygon API key is not configured");
  return raw.replace(/\s+/g, "");
}

function isoDay(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** 5-minute bars for a Polygon ticker, cached and rate-metered. */
async function loadRawBars(ticker: string, force: boolean): Promise<Bar[] | null> {
  const hit = cache.get(ticker);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  if (!force && !takeToken()) return hit?.value ?? null;
  if (force && !takeToken() && hit) return hit.value;

  const url = `${BASE}/v2/aggs/ticker/${ticker}/range/5/minute/${isoDay(4)}/${isoDay(0)}?adjusted=true&limit=50000&apiKey=${apiKey()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return hit?.value ?? null;
  const json = (await res.json()) as { results?: Record<string, number>[] };
  const bars: Bar[] = (json.results ?? [])
    .map((r) => ({
      t: Number(r["t"] ?? 0),
      open: Number(r["o"] ?? 0),
      high: Number(r["h"] ?? 0),
      low: Number(r["l"] ?? 0),
      close: Number(r["c"] ?? 0),
      volume: Number(r["v"] ?? 0),
    }))
    .filter((b) => b.close > 0 && b.t > 0)
    .sort((a, b) => a.t - b.t)
    .slice(-900);

  if (bars.length === 0) return hit?.value ?? null;
  cache.set(ticker, { at: Date.now(), value: bars });
  return bars;
}

function barsByTf(base: Bar[]): Record<Timeframe, Bar[]> {
  return {
    "1m": base,
    "5m": base,
    "15m": resample(base, 15 * 60_000),
    "1h": resample(base, 3_600_000),
  };
}

function emptyRow(inst: Instrument): MarketRow {
  return {
    key: inst.key,
    code: inst.code,
    name: inst.name,
    group: inst.group,
    ticker: inst.ticker,
    quote: inst.quote,
    last: 0,
    prevClose: 0,
    changePct: 0,
    high: 0,
    low: 0,
    volume: 0,
    spark: [],
    signals: timeframes.map((t) => tfSignal(t.id, [])),
    indicators: indicators([]),
    status: "syncing",
    updatedAt: Date.now(),
  };
}

function toRow(inst: Instrument, base: Bar[]): MarketRow {
  const tf = barsByTf(base);
  const session = base.slice(-288);
  const last = session.at(-1) as Bar;
  const first = session[0] as Bar;
  return {
    key: inst.key,
    code: inst.code,
    name: inst.name,
    group: inst.group,
    ticker: inst.ticker,
    quote: inst.quote,
    last: last.close,
    prevClose: first.open,
    changePct: first.open ? ((last.close - first.open) / first.open) * 100 : 0,
    high: Math.max(...session.map((b) => b.high)),
    low: Math.min(...session.map((b) => b.low)),
    volume: session.reduce((s, b) => s + b.volume, 0),
    spark: session.slice(-72).map((b) => b.close),
    signals: timeframes.map((t) => tfSignal(t.id, tf[t.id])),
    indicators: indicators(session),
    status: "live",
    updatedAt: last.t,
  };
}

/**
 * FX + crypto board. Cached instruments return instantly; at most a few cold
 * instruments are refreshed per call so the free-tier rate limit is respected
 * and the board warms up across successive polls.
 */
export async function loadMarketBoard(): Promise<MarketBoard> {
  const rows: MarketRow[] = [];
  let pending = 0;

  for (const inst of instruments) {
    const bars = await loadRawBars(inst.ticker, false).catch(() => null);
    if (!bars || bars.length < 5) {
      pending += 1;
      rows.push(emptyRow(inst));
      continue;
    }
    rows.push(toRow(inst, bars));
  }

  return { rows, updatedAt: Date.now(), pending };
}

export type MarketDetail = MarketRow & { bars: Bar[]; interval: Timeframe };

export async function loadMarketDetail(key: string, interval: Timeframe): Promise<MarketDetail> {
  const inst = findInstrument(key);
  if (!inst) throw new Error(`Unknown instrument “${key}”`);
  const base = await loadRawBars(inst.ticker, true);
  if (!base || base.length < 5) throw new Error(`${inst.code} tape is still syncing — try again shortly`);
  const tf = barsByTf(base);
  return { ...toRow(inst, base), bars: tf[interval].slice(-320), interval };
}
