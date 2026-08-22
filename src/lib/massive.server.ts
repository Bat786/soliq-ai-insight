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

// Requests per minute we allow ourselves. The current key answers with
// "exceeded the maximum requests per minute" after ~5 calls in a rolling
// minute, so default to that budget: an unmetered stampede burns the whole
// allowance in one board refresh and then every desk falls back to stale data.
// Set MASSIVE_RPM to a number when the plan is upgraded, or to
// "unlimited"/"0"/"none" to remove the cap entirely.
const DEFAULT_RPM = 5;
const rpm = (): number => {
  const raw = (process.env["MASSIVE_RPM"] ?? "").trim().toLowerCase();
  if (raw === "unlimited" || raw === "0" || raw === "none") return Infinity;
  if (!raw) return DEFAULT_RPM;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_RPM;
};
// Spacing between calls. Capped at 1.2s so a small per-minute budget never
// makes a desk wait tens of seconds — the token budget already protects the
// allowance, the gap only smooths bursts.
const MIN_GAP = () => {
  const limit = rpm();
  return Number.isFinite(limit) ? Math.min(1_200, Math.max(60, Math.ceil(60_000 / limit) + 20)) : 0;
};

const budget = { window: 0, used: 0 };
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;
/** A throttled endpoint family must not black out unrelated provider scopes. */
const cooldowns = new Map<string, number>();
const inflight = new Map<string, Promise<unknown>>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function takeToken(): boolean {
  const limit = rpm();
  if (!Number.isFinite(limit)) return true;
  const now = Math.floor(Date.now() / 60_000);
  if (budget.window !== now) {
    budget.window = now;
    budget.used = 0;
  }
  if (budget.used >= limit) return false;
  budget.used += 1;
  return true;
}

function queued<T>(task: () => Promise<T>): Promise<T> {
  const gap = MIN_GAP();
  if (gap === 0) return task(); // unlimited: full parallelism, no serialising chain
  const run = chain.then(async () => {
    const wait = gap - (Date.now() - lastAt);
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
const denied = new Map<string, string>();
const served = { fresh: 0, cached: 0, stale: 0, throttled: 0, errors: 0 };
let lastOkAt = 0;
let lastErrorNote: string | null = null;

/** Live health of the Massive pipeline, for the data-status surface. */
export function massiveStatus() {
  return {
    configured: Boolean(apiKey()),
    rpmLimit: Number.isFinite(rpm()) ? rpm() : null,
    cooldownMs: Math.max(0, ...[...cooldowns.values()].map((until) => until - Date.now())),
    cacheEntries: cache.size,
    lastSuccessAt: lastOkAt ? new Date(lastOkAt).toISOString() : null,
    lastError: lastErrorNote,
    counters: { ...served },
    /** Scopes the plan refused, with the provider's explanation. */
    unentitled: [...denied.entries()].map(([scope, reason]) => ({ scope, reason })),
  };
}

function apiKey(): string | null {
  const raw = process.env["MASSIVE_API_KEY"] ?? process.env["POLYGON_API_KEY"];
  return raw ? raw.replace(/\s+/g, "") : null;
}

/** GET a Massive path (already query-stringed) with metering, caching, backoff and entitlement memory. */
export async function massiveGet<T>(path: string, opts: { ttl?: number; scope?: string } = {}): Promise<T | null> {
  const ttl = opts.ttl ?? 60_000;
  const scope = opts.scope ?? path;
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttl) {
    served.cached += 1;
    return hit.value as T;
  }
  const stale = (): T | null => {
    if (hit) served.stale += 1;
    return (hit?.value as T) ?? null;
  };
  if (denied.has(scope)) return stale();

  const key = apiKey();
  if (!key) return stale();
  if (Date.now() < (cooldowns.get(scope) ?? 0)) {
    served.throttled += 1;
    return stale();
  }
  if (!takeToken()) {
    served.throttled += 1;
    return stale();
  }

  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}apiKey=${key}`;

  const existing = inflight.get(path);
  if (existing) return existing as Promise<T | null>;

  const request = (async (): Promise<T | null> => {
  // One bounded retry for server failures. Rate limits immediately return stale
  // data and cool down only this scope instead of holding every desk in a queue.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await queued(() => fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6_000) }));

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "");
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 15_000;
        lastErrorNote = `HTTP ${res.status} on ${scope}`;
        cooldowns.set(scope, Date.now() + Math.min(30_000, wait));
        served.throttled += 1;
        return stale();
      }
      if (res.status >= 500) {
        lastErrorNote = `HTTP ${res.status} on ${scope}`;
        if (attempt === 1) return stale();
        await sleep(300);
        continue;
      }

      const json = (await res.json()) as { status?: string; message?: string; error?: string };
      if (!res.ok || json.status === "NOT_AUTHORIZED" || json.status === "ERROR") {
        const note = `${json.message ?? json.error ?? `HTTP ${res.status}`}`;
        lastErrorNote = `${scope}: ${note}`;
        if (/maximum requests per minute/i.test(note)) {
          cooldowns.set(scope, Date.now() + 15_000);
          served.throttled += 1;
          return stale();
        }
        // "before end of day" / "doesn't include this data timeframe" is a
        // window limit on the current session, not a dead scope — the same scope
        // still serves closed sessions, so never blacklist it.
        const windowLimited = /end of day|data timeframe|today's data/i.test(note);
        if (!windowLimited && (json.status === "NOT_AUTHORIZED" || res.status === 403)) {
          denied.set(scope, note);
          console.warn(`[massive] not entitled: ${scope}`);
        }
        served.errors += 1;
        return stale();
      }

      cache.set(path, { at: Date.now(), value: json });
      served.fresh += 1;
      lastOkAt = Date.now();
      return json as T;
    } catch (e) {
      lastErrorNote = `${scope}: ${(e as Error).message}`;
      if (attempt === 1) {
        console.warn(`[massive] ${path} failed: ${(e as Error).message}`);
        served.errors += 1;
        return stale();
      }
      await sleep(300 * 2 ** attempt);
    }
  }
  return stale();
  })();
  inflight.set(path, request);
  try {
    return await request;
  } finally {
    inflight.delete(path);
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

/** Bars at any desk timeframe (1m → 1d) for any asset class. */
export async function massiveCustomBars(
  assetClass: AssetClass,
  symbol: string,
  tf: import("@/lib/timeframes").DeskTf,
): Promise<Bar[] | null> {
  const { tfSpec } = await import("@/lib/timeframes");
  const g = tfSpec(tf);
  const ticker = massiveTicker(assetClass, symbol);
  const path = `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${g.mult}/${g.span}/${isoDay(g.days)}/${isoDay(0)}?adjusted=true&sort=asc&limit=50000`;
  const json = await massiveGet<AggResponse>(path, { ttl: g.ttl, scope: `aggs:${assetClass}:${g.span}` });
  const bars = toBars(json).slice(-1800);
  return bars.length > 4 ? bars : null;
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
export async function groupedDay(assetClass: AssetClass, dayOffset: number): Promise<Map<string, Bar>> {
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
  days = 3,
): Promise<Map<string, Bar[]>> {
  const series = new Map<string, Bar[]>();
  const wanted = new Map(symbols.map((s) => [massiveTicker(assetClass, s), s]));
  // Newest first: today's price matters most, and older sessions fill in on
  // later polls as the request budget allows (closed days cache for hours).
  // Start at the last closed session: the in-progress day is not covered by the
  // daily summary endpoint on this plan.
  const dayRows = await Promise.all(
    Array.from({ length: days }, (_, index) => groupedDay(assetClass, index + 1).catch(() => new Map<string, Bar>())),
  );
  for (const day of dayRows) {
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
