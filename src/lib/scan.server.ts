/**
 * Full-market scanner — server only.
 *
 * One call pulls the ENTIRE US equity tape from Massive
 * (`/v2/snapshot/locale/us/markets/stocks/tickers`, no ticker filter) instead
 * of looping per-ticker snapshots. Ranking, filtering and session detection
 * are computed here; the API only supplies raw data.
 */

import { massiveGet } from "@/lib/massive.server";

export type ScanRow = {
  ticker: string;
  price: number;
  changePct: number;
  volume: number;
  prevClose: number;
  relVolume: number;
  vwap: number;
};

export type ScanFiltersInput = {
  minPrice?: number;
  maxPrice?: number;
  minVolume?: number;
  minChangePct?: number;
  topN?: number;
};

export type MarketScan = {
  session: "pre-market" | "live" | "after-hours" | "closed";
  scanned: number;
  gainers: ScanRow[];
  losers: ScanRow[];
  highVolume: ScanRow[];
  updatedAt: number;
  notes: string[];
};

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

async function snapshot<T>(path: string, ttlMs: number): Promise<T | null> {
  // Route through the shared metered/queued Massive client so the scanner
  // cannot burn the plan's request budget or trip 429s.
  return massiveGet<T>(path, { ttl: ttlMs });
}

type SnapTicker = {
  ticker?: string;
  todaysChangePerc?: number;
  day?: { c?: number; v?: number; vw?: number };
  min?: { c?: number; v?: number; vw?: number };
  prevDay?: { c?: number; v?: number };
  lastTrade?: { p?: number };
};

async function session(): Promise<MarketScan["session"]> {
  const status = await snapshot<{ market?: string; earlyHours?: boolean; afterHours?: boolean }>(
    "/v1/marketstatus/now",
    60_000,
  );
  if (!status) return "closed";
  if (status.earlyHours) return "pre-market";
  if (status.afterHours) return "after-hours";
  return status.market === "open" ? "live" : "closed";
}

function toRow(t: SnapTicker): ScanRow | null {
  const ticker = typeof t.ticker === "string" ? t.ticker : "";
  if (!ticker) return null;
  const price = num(t.day?.c) || num(t.min?.c) || num(t.lastTrade?.p);
  if (price <= 0) return null;
  const volume = num(t.day?.v) || num(t.min?.v);
  const prevVolume = num(t.prevDay?.v);
  return {
    ticker,
    price,
    changePct: num(t.todaysChangePerc),
    volume,
    prevClose: num(t.prevDay?.c),
    relVolume: prevVolume > 0 ? volume / prevVolume : 0,
    vwap: num(t.day?.vw) || num(t.min?.vw),
  };
}

/** Rank the whole tape. Every threshold is caller-supplied, nothing hardcoded. */
export async function loadMarketScan(filters: ScanFiltersInput = {}): Promise<MarketScan> {
  const notes: string[] = [];
  const minPrice = filters.minPrice ?? 1;
  const maxPrice = filters.maxPrice ?? Number.POSITIVE_INFINITY;
  const minVolume = filters.minVolume ?? 100_000;
  const minChangePct = filters.minChangePct ?? 0;
  const topN = Math.min(50, Math.max(5, filters.topN ?? 20));

  const [sess, snap] = await Promise.all([
    session(),
    snapshot<{ tickers?: SnapTicker[] }>("/v2/snapshot/locale/us/markets/stocks/tickers", 30_000),
  ]);

  let rows: ScanRow[] = Array.isArray(snap?.tickers)
    ? snap.tickers.map(toRow).filter((r): r is ScanRow => r !== null)
    : [];
  let scanned = rows.length;

  if (rows.length === 0) {
    // Plans without real-time snapshot entitlement still get the whole tape from
    // the grouped daily bars — one call per session, every listed ticker.
    const grouped = await groupedScan();
    rows = grouped.rows;
    scanned = grouped.scanned;
    if (grouped.day) notes.push(`Whole-tape close scan for ${grouped.day} (plan has no real-time snapshot).`);
    else notes.push("Full-market data unavailable right now.");
  }

  const candidates = rows

    .filter(
      (r) =>
        r.price >= minPrice &&
        r.price <= maxPrice &&
        r.volume >= minVolume &&
        Math.abs(r.changePct) >= minChangePct,
    );

  return {
    session: sess,
    scanned,
    gainers: [...candidates].sort((a, b) => b.changePct - a.changePct).slice(0, topN),
    losers: [...candidates].sort((a, b) => a.changePct - b.changePct).slice(0, topN),
    highVolume: [...candidates].sort((a, b) => b.volume - a.volume).slice(0, topN),
    updatedAt: Date.now(),
    notes,
  };
}

/* --------------------------- grouped-day fallback -------------------------- */

type GroupedBar = { T?: string; c?: number; v?: number; vw?: number };

async function groupedDay(dayOffset: number): Promise<{ day: string; bars: Map<string, GroupedBar> } | null> {
  const day = new Date(Date.now() - dayOffset * 86_400_000).toISOString().slice(0, 10);
  const res = await snapshot<{ results?: GroupedBar[] }>(
    `/v2/aggs/grouped/locale/us/market/stocks/${day}?adjusted=true`,
    10 * 60_000,
  );
  const results = Array.isArray(res?.results) ? res.results : [];
  if (results.length === 0) return null;
  const bars = new Map<string, GroupedBar>();
  for (const b of results) if (typeof b.T === "string") bars.set(b.T, b);
  return { day, bars };
}

async function groupedScan(): Promise<{ rows: ScanRow[]; scanned: number; day: string | null }> {
  let latest: { day: string; bars: Map<string, GroupedBar> } | null = null;
  let offset = 1;
  for (; offset <= 5 && !latest; offset += 1) latest = await groupedDay(offset);
  if (!latest) return { rows: [], scanned: 0, day: null };

  let prior: { day: string; bars: Map<string, GroupedBar> } | null = null;
  for (let i = offset; i <= offset + 4 && !prior; i += 1) prior = await groupedDay(i);

  const rows: ScanRow[] = [];
  for (const [ticker, bar] of latest.bars) {
    const price = num(bar.c);
    if (price <= 0) continue;
    const prevBar = prior?.bars.get(ticker);
    const prevClose = num(prevBar?.c);
    const prevVolume = num(prevBar?.v);
    const volume = num(bar.v);
    rows.push({
      ticker,
      price,
      changePct: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
      volume,
      prevClose,
      relVolume: prevVolume > 0 ? volume / prevVolume : 0,
      vwap: num(bar.vw),
    });
  }
  return { rows, scanned: rows.length, day: latest.day };
}

/* ------------------------------ crypto scanner ----------------------------- */

export type CryptoScanRow = {
  symbol: string;
  name: string;
  source: "pump.fun" | "coingecko" | "massive";
  price: number;
  changePct: number;
  volume: number;
  liquidity: number;
  url: string | null;
};

export type CryptoScan = {
  launches: CryptoScanRow[];
  majors: CryptoScanRow[];
  updatedAt: number;
  notes: string[];
};

async function json<T>(url: string, ttlMs: number): Promise<T | null> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    const value = (await res.json()) as T;
    cache.set(url, { at: Date.now(), value });
    return value;
  } catch {
    return (hit?.value as T) ?? null;
  }
}

/** Pump.fun launches, resolved through DexScreener's pumpfun pair feed. */
async function pumpLaunches(): Promise<CryptoScanRow[]> {
  const data = await json<{ pairs?: Record<string, unknown>[] }>(
    "https://api.dexscreener.com/latest/dex/search?q=pump",
    60_000,
  );
  const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
  return pairs
    .filter((p) => String(p["dexId"] ?? "").includes("pump") || String(p["labels"] ?? "").includes("pump"))
    .slice(0, 24)
    .map((p) => {
      const base = (p["baseToken"] ?? {}) as Record<string, unknown>;
      const vol = (p["volume"] ?? {}) as Record<string, unknown>;
      const chg = (p["priceChange"] ?? {}) as Record<string, unknown>;
      const liq = (p["liquidity"] ?? {}) as Record<string, unknown>;
      return {
        symbol: String(base["symbol"] ?? "—"),
        name: String(base["name"] ?? ""),
        source: "pump.fun" as const,
        price: Number(p["priceUsd"] ?? 0) || 0,
        changePct: num(chg["h24"]),
        volume: num(vol["h24"]),
        liquidity: num(liq["usd"]),
        url: typeof p["url"] === "string" ? p["url"] : null,
      };
    })
    .sort((a, b) => b.volume - a.volume);
}

/** CoinGecko majors — full-market page in one call, no key required. */
async function geckoMajors(): Promise<CryptoScanRow[]> {
  const data = await json<Record<string, unknown>[]>(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=50&page=1",
    60_000,
  );
  if (!Array.isArray(data)) return [];
  return data.map((c) => ({
    symbol: String(c["symbol"] ?? "").toUpperCase(),
    name: String(c["name"] ?? ""),
    source: "coingecko" as const,
    price: num(c["current_price"]),
    changePct: num(c["price_change_percentage_24h"]),
    volume: num(c["total_volume"]),
    liquidity: num(c["market_cap"]),
    url: null,
  }));
}

export async function loadCryptoScan(): Promise<CryptoScan> {
  const notes: string[] = [];
  const [launches, majors] = await Promise.all([
    pumpLaunches().catch(() => {
      notes.push("Pump.fun launch feed unavailable right now.");
      return [] as CryptoScanRow[];
    }),
    geckoMajors().catch(() => {
      notes.push("CoinGecko majors unavailable right now.");
      return [] as CryptoScanRow[];
    }),
  ]);
  return { launches, majors, updatedAt: Date.now(), notes };
}
