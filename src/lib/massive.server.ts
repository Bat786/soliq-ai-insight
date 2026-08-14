/**
 * Massive (formerly Polygon.io) REST client — server only.
 *
 * One metered, cached gateway for every desk: stocks, crypto, forex and
 * indices. The account plan controls which slices come back live, so every
 * helper degrades to `null` instead of throwing, and any `NOT_AUTHORIZED`
 * answer is remembered so we stop spending request budget on it.
 *
 * Ticker conventions (Massive):
 *   stocks   AAPL
 *   crypto   X:BTCUSD
 *   forex    C:EURUSD
 *   indices  I:SPX
 */

import type { Bar, Timeframe } from "@/lib/futures.server";

const BASE = "https://api.polygon.io"; // Massive keeps the polygon.io REST host

export type AssetClass = "stocks" | "crypto" | "fx" | "indices";

/* ------------------------------ rate metering ----------------------------- */

const LIMIT = 90; // requests per minute we allow ourselves against the plan
const MIN_GAP = 160;
const budget = { window: 0, used: 0 };
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/* --------------------------------- caching -------------------------------- */

type Entry = { at: number; value: unknown };
const cache = new Map<string, Entry>();
const denied = new Set<string>();

function apiKey(): string | null {
  const raw = process.env["MASSIVE_API_KEY"] ?? process.env["POLYGON_API_KEY"];
  return raw ? raw.replace(/\s+/g, "") : null;
}

/** GET a Massive path (already query-stringed) with metering, caching and entitlement memory. */
export async function massiveGet<T>(path: string, opts: { ttl?: number; scope?: string } = {}): Promise<T | null> {
  const ttl = opts.ttl ?? 60_000;
  const scope = opts.scope ?? path;
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  if (denied.has(scope)) return (hit?.value as T) ?? null;

  const key = apiKey();
  if (!key) return (hit?.value as T) ?? null;
  if (!takeToken()) return (hit?.value as T) ?? null;

  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}apiKey=${key}`;
  try {
    const res = await queued(() => fetch(url, { headers: { Accept: "application/json" } }));
    if (res.status === 429) return (hit?.value as T) ?? null;
    const json = (await res.json()) as { status?: string; message?: string };
    if (!res.ok || json.status === "NOT_AUTHORIZED" || json.status === "ERROR") {
      if (json.status === "NOT_AUTHORIZED" || res.status === 403) {
        denied.add(scope);
        console.warn(`[massive] not entitled: ${scope}`);
      }
      return (hit?.value as T) ?? null;
    }
    cache.set(path, { at: Date.now(), value: json });
    return json as T;
  } catch (e) {
    console.warn(`[massive] ${path} failed: ${(e as Error).message}`);
    return (hit?.value as T) ?? null;
  }
}

/* -------------------------------- aggregates ------------------------------- */

type AggResponse = { results?: Record<string, number>[] };

const grid: Record<Timeframe, { mult: number; span: "minute" | "hour" | "day"; days: number; ttl: number }> = {
  "1m": { mult: 1, span: "minute", days: 3, ttl: 45_000 },
  "5m": { mult: 5, span: "minute", days: 7, ttl: 60_000 },
  "15m": { mult: 15, span: "minute", days: 14, ttl: 90_000 },
  "1h": { mult: 1, span: "hour", days: 45, ttl: 120_000 },
  "4h": { mult: 4, span: "hour", days: 120, ttl: 180_000 },
};

const isoDay = (offsetDays: number) => new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);

export function massiveTicker(assetClass: AssetClass, symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (assetClass === "stocks") return s;
  if (assetClass === "crypto") return s.startsWith("X:") ? s : `X:${s.replace(/[-/]/g, "")}`;
  if (assetClass === "fx") return s.startsWith("C:") ? s : `C:${s.replace(/[-/=X]/g, "")}`;
  return s.startsWith("I:") ? s : `I:${s.replace(/^\^/, "")}`;
}

function toBars(json: AggResponse | null): Bar[] {
  return (json?.results ?? [])
    .map((r) => ({
      t: Number(r["t"] ?? 0),
      open: Number(r["o"] ?? 0),
      high: Number(r["h"] ?? 0),
      low: Number(r["l"] ?? 0),
      close: Number(r["c"] ?? 0),
      volume: Number(r["v"] ?? 0),
    }))
    .filter((b) => b.close > 0 && b.t > 0)
    .sort((a, b) => a.t - b.t);
}

/**
 * Custom bars for any asset class at a terminal timeframe (1m → 4h).
 * Returns `null` when the plan or the market has nothing for us, so callers can
 * fall through to another provider.
 */
export async function massiveBars(
  assetClass: AssetClass,
  symbol: string,
  tf: Timeframe,
): Promise<Bar[] | null> {
  const g = grid[tf];
  const ticker = massiveTicker(assetClass, symbol);
  const path = `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${g.mult}/${g.span}/${isoDay(g.days)}/${isoDay(0)}?adjusted=true&sort=asc&limit=50000`;
  const json = await massiveGet<AggResponse>(path, { ttl: g.ttl, scope: `aggs:${assetClass}:${g.span}` });
  const bars = toBars(json).slice(-1500);
  return bars.length > 4 ? bars : null;
}

/** Daily bars — the widest entitlement on every asset class, used as a floor. */
export async function massiveDailyBars(assetClass: AssetClass, symbol: string, days = 400): Promise<Bar[] | null> {
  const ticker = massiveTicker(assetClass, symbol);
  const path = `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${isoDay(days)}/${isoDay(0)}?adjusted=true&sort=asc&limit=5000`;
  const json = await massiveGet<AggResponse>(path, { ttl: 10 * 60_000, scope: `aggs:${assetClass}:day` });
  const bars = toBars(json);
  return bars.length > 4 ? bars : null;
}

/** Previous-day OHLCV bar (cheap "is it up or down today" probe). */
export async function massivePrevBar(assetClass: AssetClass, symbol: string): Promise<Bar | null> {
  const ticker = massiveTicker(assetClass, symbol);
  const json = await massiveGet<AggResponse>(`/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true`, {
    ttl: 5 * 60_000,
    scope: `prev:${assetClass}`,
  });
  return toBars(json)[0] ?? null;
}

/* --------------------- whole-market daily summary (board) -------------------- */

const groupedLocale: Record<AssetClass, string | null> = {
  stocks: "us/market/stocks",
  crypto: "global/market/crypto",
  fx: "global/market/fx",
  indices: null, // not covered by the grouped endpoint
};

/**
 * Daily market summary: every ticker in an asset class for one session, in a
 * single request. This is how the desk boards stay populated without spending
 * one request per symbol.
 */
async function groupedDay(assetClass: AssetClass, dayOffset: number): Promise<Map<string, Bar>> {
  const locale = groupedLocale[assetClass];
  const out = new Map<string, Bar>();
  if (!locale) return out;
  const day = isoDay(dayOffset);
  const path = `/v2/aggs/grouped/locale/${locale}/${day}?adjusted=true`;
  const json = await massiveGet<{ results?: Record<string, string | number>[] }>(path, {
    // Closed sessions never change; today's summary refreshes on a short clock.
    ttl: 12 * 3600_000,
    // Per-day scope: the plan rejects the in-progress session, and that must not
    // disqualify the closed sessions we are entitled to.
    scope: `grouped:${assetClass}:${day}`,
  });
  for (const r of json?.results ?? []) {
    const ticker = String(r["T"] ?? "");
    const close = Number(r["c"] ?? 0);
    if (!ticker || !(close > 0)) continue;
    out.set(ticker, {
      t: Number(r["t"] ?? 0),
      open: Number(r["o"] ?? close),
      high: Number(r["h"] ?? close),
      low: Number(r["l"] ?? close),
      close,
      volume: Number(r["v"] ?? 0),
    });
  }
  return out;
}

/**
 * Daily bar series for many symbols at once, assembled from `days` whole-market
 * summaries. Non-trading days simply contribute nothing.
 */
export async function massiveBoardSeries(
  assetClass: AssetClass,
  symbols: string[],
  days = 10,
): Promise<Map<string, Bar[]>> {
  const series = new Map<string, Bar[]>();
  const wanted = new Map(symbols.map((s) => [massiveTicker(assetClass, s), s]));
  // Newest first: today's price matters most, and older sessions fill in on
  // later polls as the request budget allows (closed days cache for hours).
  // Start at the last closed session: the in-progress day is not covered by the
  // daily summary endpoint on this plan.
  for (let offset = 1; offset <= days; offset++) {
    const day = await groupedDay(assetClass, offset).catch(() => new Map<string, Bar>());
    if (day.size === 0) continue;
    for (const [ticker, symbol] of wanted) {
      const bar = day.get(ticker);
      if (!bar) continue;
      const list = series.get(symbol) ?? [];
      list.push(bar);
      series.set(symbol, list);
    }
  }
  for (const [symbol, list] of series) {
    series.set(
      symbol,
      list.sort((a, b) => a.t - b.t),
    );
  }
  return series;
}



/* ----------------------------- market operations ---------------------------- */

export type MarketStatus = {
  market: string;
  afterHours: boolean;
  earlyHours: boolean;
  exchanges: Record<string, string>;
  currencies: Record<string, string>;
  serverTime: string | null;
};

export async function massiveMarketStatus(): Promise<MarketStatus | null> {
  const json = await massiveGet<Record<string, unknown>>("/v1/marketstatus/now", { ttl: 60_000, scope: "marketstatus" });
  if (!json) return null;
  return {
    market: String(json["market"] ?? "unknown"),
    afterHours: Boolean(json["afterHours"]),
    earlyHours: Boolean(json["earlyHours"]),
    exchanges: (json["exchanges"] as Record<string, string>) ?? {},
    currencies: (json["currencies"] as Record<string, string>) ?? {},
    serverTime: (json["serverTime"] as string) ?? null,
  };
}

/* -------------------------------- reference -------------------------------- */

export type TickerOverview = {
  ticker: string;
  name: string;
  market: string;
  exchange: string | null;
  description: string | null;
  marketCap: number | null;
  employees: number | null;
  homepage: string | null;
  branding: string | null;
};

export async function massiveTickerOverview(ticker: string): Promise<TickerOverview | null> {
  const json = await massiveGet<{ results?: Record<string, unknown> }>(
    `/v3/reference/tickers/${encodeURIComponent(ticker.toUpperCase())}`,
    { ttl: 24 * 3600_000, scope: "reference:ticker" },
  );
  const r = json?.results;
  if (!r) return null;
  return {
    ticker: String(r["ticker"] ?? ticker.toUpperCase()),
    name: String(r["name"] ?? ticker.toUpperCase()),
    market: String(r["market"] ?? ""),
    exchange: (r["primary_exchange"] as string) ?? null,
    description: (r["description"] as string) ?? null,
    marketCap: typeof r["market_cap"] === "number" ? (r["market_cap"] as number) : null,
    employees: typeof r["total_employees"] === "number" ? (r["total_employees"] as number) : null,
    homepage: (r["homepage_url"] as string) ?? null,
    branding: ((r["branding"] as Record<string, string> | undefined)?.["logo_url"] as string) ?? null,
  };
}

export type MassiveSearchHit = { symbol: string; name: string; market: string; type: string; exchange: string };

/** Universal symbol search across stocks, crypto, fx and indices. */
export async function massiveSearch(q: string): Promise<MassiveSearchHit[]> {
  const term = q.trim();
  if (term.length < 1) return [];
  const json = await massiveGet<{ results?: Record<string, unknown>[] }>(
    `/v3/reference/tickers?search=${encodeURIComponent(term)}&active=true&limit=20`,
    { ttl: 6 * 3600_000, scope: "reference:search" },
  );
  return (json?.results ?? []).map((r) => ({
    symbol: String(r["ticker"] ?? ""),
    name: String(r["name"] ?? r["ticker"] ?? ""),
    market: String(r["market"] ?? ""),
    type: String(r["type"] ?? r["market"] ?? "").toLowerCase(),
    exchange: String(r["primary_exchange"] ?? ""),
  }));
}

export type MassiveNews = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  tickers: string[];
  sentiment: string | null;
  image: string | null;
};

export async function massiveNews(ticker?: string, limit = 12): Promise<MassiveNews[]> {
  const qs = ticker ? `ticker=${encodeURIComponent(ticker.toUpperCase())}&` : "";
  const json = await massiveGet<{ results?: Record<string, unknown>[] }>(
    `/v2/reference/news?${qs}order=desc&limit=${limit}`,
    { ttl: 5 * 60_000, scope: "reference:news" },
  );
  return (json?.results ?? []).map((r) => ({
    id: String(r["id"] ?? r["article_url"] ?? ""),
    title: String(r["title"] ?? ""),
    publisher: String((r["publisher"] as Record<string, unknown> | undefined)?.["name"] ?? ""),
    url: String(r["article_url"] ?? ""),
    publishedAt: String(r["published_utc"] ?? ""),
    tickers: ((r["tickers"] as string[]) ?? []).slice(0, 6),
    sentiment:
      ((r["insights"] as Record<string, unknown>[] | undefined)?.[0]?.["sentiment"] as string | undefined) ?? null,
    image: (r["image_url"] as string) ?? null,
  }));
}

/** Whether the client has a usable key at all (used for status badges). */
export function massiveConfigured(): boolean {
  return Boolean(apiKey());
}
