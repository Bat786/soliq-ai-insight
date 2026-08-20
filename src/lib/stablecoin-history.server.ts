/**
 * Long-range peg history from Massive flat files — server only.
 *
 * Flat files are daily gzipped CSV snapshots of every crypto ticker
 * (`global_crypto/day_aggs_v1/YYYY/MM/YYYY-MM-DD.csv.gz`), so one download
 * covers every stablecoin for that day. We fetch the requested window with
 * bounded concurrency, then cache the parsed result in memory: the history is
 * end-of-day data and never changes once written.
 */

import { flatFilesConfigured, listFlatFiles, readFlatFileCsv } from "@/lib/massive-flatfiles.server";

export type PegPoint = { date: string; close: number; high: number; low: number; bps: number };

export type PegHistoryRow = {
  symbol: string;
  /** Flat-file ticker, e.g. X:USDC-USD. */
  ticker: string;
  peg: number;
  points: PegPoint[];
  stats: {
    days: number;
    avgAbsBps: number;
    worstBps: number;
    worstDate: string | null;
    /** Days where |deviation| exceeded 50 bps. */
    daysOffPeg: number;
    /** Share of days inside 25 bps of peg. */
    uptimePct: number;
  };
};

export type PegHistory = {
  days: number;
  from: string | null;
  to: string | null;
  rows: PegHistoryRow[];
  notes: string[];
  updatedAt: string;
};

/** Flat-file tickers for the desk's coins. */
const TICKERS: { symbol: string; ticker: string; peg: number }[] = [
  { symbol: "USDC", ticker: "X:USDC-USD", peg: 1 },
  { symbol: "USDT", ticker: "X:USDT-USD", peg: 1 },
  { symbol: "DAI", ticker: "X:DAI-USD", peg: 1 },
  { symbol: "PYUSD", ticker: "X:PYUSD-USD", peg: 1 },
  { symbol: "EURC", ticker: "X:EURC-EUR", peg: 1 },
];

const PREFIX = "global_crypto/day_aggs_v1";
const MAX_DAYS = 365;
const CONCURRENCY = 4;

type DayRow = { close: number; high: number; low: number };

/** date -> ticker -> bar. Flat files are immutable, so this cache never expires. */
const dayCache = new Map<string, Map<string, DayRow>>();
const monthKeys = new Map<string, string[]>();

const num = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const dateFromKey = (key: string) => key.split("/").pop()?.replace(".csv.gz", "") ?? key;

async function keysForMonth(year: number, month: number): Promise<string[]> {
  const prefix = `${PREFIX}/${year}/${String(month).padStart(2, "0")}/`;
  const cached = monthKeys.get(prefix);
  if (cached) return cached;
  const { keys } = await listFlatFiles(prefix, { maxKeys: 40 });
  const sorted = keys.filter((k) => k.endsWith(".csv.gz")).sort();
  monthKeys.set(prefix, sorted);
  return sorted;
}

async function loadDay(key: string, wanted: Set<string>): Promise<void> {
  const date = dateFromKey(key);
  if (dayCache.has(date)) return;
  const rows = await readFlatFileCsv(key);
  const map = new Map<string, DayRow>();
  for (const row of rows) {
    const ticker = row["ticker"];
    if (!ticker || !wanted.has(ticker)) continue;
    map.set(ticker, { close: num(row["close"]), high: num(row["high"]), low: num(row["low"]) });
  }
  dayCache.set(date, map);
}

const bps = (price: number, peg: number) => ((price - peg) / peg) * 10_000;

/** Loads `days` of end-of-day peg history for every tracked stablecoin. */
export async function loadPegHistory(days = 30): Promise<PegHistory> {
  const window = Math.max(7, Math.min(MAX_DAYS, Math.round(days)));
  const notes: string[] = [];

  if (!flatFilesConfigured()) {
    return {
      days: window,
      from: null,
      to: null,
      rows: [],
      notes: ["Massive flat-file credentials are not configured — historical peg data unavailable."],
      updatedAt: new Date().toISOString(),
    };
  }

  // Walk back month by month until we have enough daily objects.
  const cursor = new Date();
  const keys: string[] = [];
  for (let i = 0; i < 14 && keys.length < window; i += 1) {
    try {
      const monthly = await keysForMonth(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1);
      keys.unshift(...monthly);
    } catch (error) {
      notes.push((error as Error).message);
      break;
    }
    cursor.setUTCDate(1);
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }

  const selected = keys.slice(-window);
  if (selected.length === 0) {
    return {
      days: window,
      from: null,
      to: null,
      rows: [],
      notes: notes.length ? notes : ["No flat files found for the requested window."],
      updatedAt: new Date().toISOString(),
    };
  }

  const wanted = new Set(TICKERS.map((t) => t.ticker));
  let failures = 0;
  for (let i = 0; i < selected.length; i += CONCURRENCY) {
    const batch = selected.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((key) => loadDay(key, wanted)));
    failures += settled.filter((s) => s.status === "rejected").length;
  }
  if (failures > 0) notes.push(`${failures} daily flat file(s) could not be read and were skipped.`);

  const dates = selected.map(dateFromKey).filter((d) => dayCache.has(d));

  const rows: PegHistoryRow[] = TICKERS.map((coin) => {
    const points: PegPoint[] = [];
    for (const date of dates) {
      const bar = dayCache.get(date)?.get(coin.ticker);
      if (!bar || !bar.close) continue;
      points.push({
        date,
        close: bar.close,
        high: bar.high,
        low: bar.low,
        bps: bps(bar.close, coin.peg),
      });
    }

    let worst = 0;
    let worstDate: string | null = null;
    let absSum = 0;
    let offPeg = 0;
    let tight = 0;
    for (const p of points) {
      // Intraday extreme, so a wick off peg is not hidden by a clean close.
      const dev = [p.bps, bps(p.high, coin.peg), bps(p.low, coin.peg)].reduce(
        (acc, v) => (Math.abs(v) > Math.abs(acc) ? v : acc),
        0,
      );
      if (Math.abs(dev) > Math.abs(worst)) {
        worst = dev;
        worstDate = p.date;
      }
      absSum += Math.abs(p.bps);
      if (Math.abs(dev) > 50) offPeg += 1;
      if (Math.abs(p.bps) <= 25) tight += 1;
    }

    return {
      symbol: coin.symbol,
      ticker: coin.ticker,
      peg: coin.peg,
      points,
      stats: {
        days: points.length,
        avgAbsBps: points.length ? absSum / points.length : 0,
        worstBps: worst,
        worstDate,
        daysOffPeg: offPeg,
        uptimePct: points.length ? (tight / points.length) * 100 : 0,
      },
    };
  }).filter((row) => row.points.length > 0);

  if (rows.length === 0) notes.push("Flat files contained no rows for the tracked stablecoin tickers.");

  return {
    days: window,
    from: dates[0] ?? null,
    to: dates.at(-1) ?? null,
    rows,
    notes,
    updatedAt: new Date().toISOString(),
  };
}
