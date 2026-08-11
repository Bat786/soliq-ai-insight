/** Polygon.io 24/7 FX + crypto tape and shared technical indicators (server only). */

import { resample, tfSignal, timeframes, type Bar, type TfSignal, type Timeframe } from "@/lib/futures.server";
import { indicators, type Indicators } from "@/lib/indicators.server";

const BASE = "https://api.polygon.io";

export type { Indicators };


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

export { indicators };



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
    "4h": resample(base, 4 * 3_600_000),
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
