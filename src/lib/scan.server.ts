/**
 * Full-market scanner — server only.
 *
 * One call pulls the ENTIRE US equity tape from Massive
 * (`/v2/snapshot/locale/us/markets/stocks/tickers`, no ticker filter) instead
 * of looping per-ticker snapshots. Ranking, filtering and session detection
 * are computed here; the API only supplies raw data.
 */

const BASE = "https://api.polygon.io";

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

type Entry = { at: number; value: unknown };
const cache = new Map<string, Entry>();

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

function key(): string | null {
  const raw = process.env["MASSIVE_API_KEY"] ?? process.env["POLYGON_API_KEY"];
  return raw ? raw.replace(/\s+/g, "") : null;
}

async function snapshot<T>(path: string, ttlMs: number): Promise<T | null> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const k = key();
  if (!k) return (hit?.value as T) ?? null;
  const sep = path.includes("?") ? "&" : "?";
  try {
    const res = await fetch(`${BASE}${path}${sep}apiKey=${k}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return (hit?.value as T) ?? null;
    const json = (await res.json()) as { status?: string };
    if (json.status === "NOT_AUTHORIZED" || json.status === "ERROR") return (hit?.value as T) ?? null;
    cache.set(path, { at: Date.now(), value: json });
    return json as T;
  } catch {
    return (hit?.value as T) ?? null;
  }
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

  const all = Array.isArray(snap?.tickers) ? snap.tickers : [];
  if (all.length === 0) notes.push("Full-market snapshot unavailable — check the Massive plan entitlement.");

  const candidates = all
    .map(toRow)
    .filter((r): r is ScanRow => r !== null)
    .filter(
      (r) =>
        r.price >= minPrice &&
        r.price <= maxPrice &&
        r.volume >= minVolume &&
        Math.abs(r.changePct) >= minChangePct,
    );

  return {
    session: sess,
    scanned: all.length,
    gainers: [...candidates].sort((a, b) => b.changePct - a.changePct).slice(0, topN),
    losers: [...candidates].sort((a, b) => a.changePct - b.changePct).slice(0, topN),
    highVolume: [...candidates].sort((a, b) => b.volume - a.volume).slice(0, topN),
    updatedAt: Date.now(),
    notes,
  };
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
