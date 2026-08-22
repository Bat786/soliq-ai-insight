/**
 * Twelve Data adapter — server only.
 *
 * An ADDITIONAL provider alongside Massive, Unusual Whales, Jupiter,
 * DexScreener, CoinGecko/GeckoTerminal and Alchemy. It replaces nothing: every
 * helper returns `null` when the key is missing, the plan does not cover the
 * slice, or the request is refused, so callers fall through to whichever
 * existing provider the routing table names next.
 *
 * All traffic goes through the shared gateway (`metered` + `fetchProvider`), so
 * the free plan's request allowance is respected by the same budget/cache
 * machinery every other provider uses. No polling loops, no websockets.
 */

import { fetchProvider, getJson } from "@/engines/core/gateway.server";
import type { Bar } from "@/lib/futures.server";

const BASE = "https://api.twelvedata.com";

const PROVIDER = "twelvedata" as const;

function apiKey(): string | null {
  const raw = process.env["TWELVE_DATA_API_KEY"];
  return raw ? raw.replace(/\s+/g, "") : null;
}

export function twelveDataConfigured(): boolean {
  return Boolean(apiKey());
}

/** Scopes the plan refused, so we stop spending the allowance on them. */
const denied = new Map<string, string>();
let lastError: string | null = null;
let lastOkAt = 0;

export function twelveDataStatus() {
  return {
    configured: twelveDataConfigured(),
    lastSuccessAt: lastOkAt ? new Date(lastOkAt).toISOString() : null,
    lastError,
    unentitled: [...denied.entries()].map(([scope, reason]) => ({ scope, reason })),
  };
}

type TdError = { status?: string; code?: number; message?: string };

/**
 * GET a Twelve Data path. `scope` groups requests for entitlement memory
 * (e.g. `time_series`), `ttlMs` drives the shared cache.
 */
async function td<T>(path: string, opts: { scope: string; ttlMs: number }): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;
  if (denied.has(opts.scope)) return null;

  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}apikey=${key}`;

  const hit = await fetchProvider<T>({
    provider: PROVIDER,
    // Cache key must exclude the key itself.
    key: `td:${path}`,
    ttlMs: opts.ttlMs,
    retries: 2,
    load: async () => {
      const json = await getJson<T & TdError>(url, { timeoutMs: 10_000 });
      if (!json) return null;
      const status = (json as TdError).status;
      const code = (json as TdError).code;
      if (status === "error") {
        const note = (json as TdError).message ?? `code ${code ?? "?"}`;
        lastError = `${opts.scope}: ${note}`;
        // 401/403/404-style refusals are permanent for this scope; 429 is not.
        if (code && [401, 403, 404, 400].includes(code)) denied.set(opts.scope, note);
        if (code === 429) throw new Error("429 rate limited");
        return null;
      }
      lastOkAt = Date.now();
      return json;
    },
  });
  return hit?.value ?? null;
}

/* --------------------------------- quotes --------------------------------- */

export type TdQuote = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  price: number;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  ts: number;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

function toQuote(raw: Record<string, unknown>): TdQuote | null {
  const price = num(raw["close"]) ?? num(raw["price"]);
  const symbol = String(raw["symbol"] ?? "").toUpperCase();
  if (!symbol || price === null) return null;
  return {
    symbol,
    name: (raw["name"] as string) ?? null,
    exchange: (raw["exchange"] as string) ?? null,
    currency: (raw["currency"] as string) ?? null,
    price,
    open: num(raw["open"]),
    high: num(raw["high"]),
    low: num(raw["low"]),
    prevClose: num(raw["previous_close"]),
    change: num(raw["change"]),
    changePct: num(raw["percent_change"]),
    volume: num(raw["volume"]),
    ts: (num(raw["timestamp"]) ?? Math.floor(Date.now() / 1000)) * 1000,
  };
}

/**
 * Batched quote lookup — one request for up to 8 symbols, which is how the free
 * plan stays inside its allowance. Symbols use Twelve Data conventions
 * (`AAPL`, `BTC/USD`, `EUR/USD`, `XAU/USD`).
 */
export async function twelveDataQuotes(symbols: string[]): Promise<Map<string, TdQuote>> {
  const out = new Map<string, TdQuote>();
  const list = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 8);
  if (list.length === 0) return out;

  const json = await td<Record<string, unknown>>(`/quote?symbol=${encodeURIComponent(list.join(","))}`, {
    scope: "quote",
    ttlMs: 60_000,
  });
  if (!json) return out;

  // One symbol → a flat object; many symbols → keyed by symbol.
  const entries: [string, unknown][] =
    list.length === 1 ? [[list[0] as string, json]] : (Object.entries(json) as [string, unknown][]);
  for (const [symbolKey, value] of entries) {
    if (!value || typeof value !== "object") continue;
    const quote = toQuote({ symbol: symbolKey, ...(value as Record<string, unknown>) });
    if (quote) out.set(symbolKey.toUpperCase(), quote);
  }
  return out;
}

export async function twelveDataQuote(symbol: string): Promise<TdQuote | null> {
  return (await twelveDataQuotes([symbol])).get(symbol.trim().toUpperCase()) ?? null;
}

/* ------------------------------- time series ------------------------------- */

export type TdInterval = "1min" | "5min" | "15min" | "30min" | "45min" | "1h" | "2h" | "4h" | "1day" | "1week" | "1month";

/** Map SOLIQ desk timeframes onto Twelve Data intervals. */
export function tdInterval(tf: string): TdInterval {
  switch (tf) {
    case "1m":
      return "1min";
    case "2m":
    case "3m":
    case "5m":
      return "5min";
    case "10m":
    case "15m":
      return "15min";
    case "30m":
      return "30min";
    case "1h":
      return "1h";
    case "4h":
      return "4h";
    case "1w":
      return "1week";
    case "1M":
      return "1month";
    default:
      return "1day";
  }
}

const seriesTtl: Partial<Record<TdInterval, number>> = {
  "1min": 60_000,
  "5min": 120_000,
  "15min": 180_000,
  "30min": 300_000,
  "1h": 600_000,
  "4h": 900_000,
  "1day": 3_600_000,
  "1week": 6 * 3_600_000,
  "1month": 12 * 3_600_000,
};

/** OHLCV bars, oldest → newest. `null` when the plan or symbol has nothing. */
export async function twelveDataBars(symbol: string, interval: TdInterval, outputsize = 400): Promise<Bar[] | null> {
  const json = await td<{ values?: Record<string, string>[] }>(
    `/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${Math.min(5000, outputsize)}&order=ASC`,
    { scope: `time_series:${interval}`, ttlMs: seriesTtl[interval] ?? 600_000 },
  );
  const values = json?.values ?? [];
  const bars = values
    .map((v) => ({
      t: Date.parse(`${v["datetime"] ?? ""}${/\d{2}:\d{2}/.test(v["datetime"] ?? "") ? "Z" : "T00:00:00Z"}`),
      open: num(v["open"]) ?? 0,
      high: num(v["high"]) ?? 0,
      low: num(v["low"]) ?? 0,
      close: num(v["close"]) ?? 0,
      volume: num(v["volume"]) ?? 0,
    }))
    .filter((b) => Number.isFinite(b.t) && b.close > 0)
    .sort((a, b) => a.t - b.t);
  return bars.length > 4 ? bars : null;
}

/* ----------------------------- reference / search ---------------------------- */

export type TdSearchHit = { symbol: string; name: string; exchange: string; type: string; currency: string };

export async function twelveDataSearch(query: string): Promise<TdSearchHit[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const json = await td<{ data?: Record<string, unknown>[] }>(
    `/symbol_search?symbol=${encodeURIComponent(q)}&outputsize=15`,
    { scope: "symbol_search", ttlMs: 6 * 3_600_000 },
  );
  return (json?.data ?? []).map((r) => ({
    symbol: String(r["symbol"] ?? ""),
    name: String(r["instrument_name"] ?? r["symbol"] ?? ""),
    exchange: String(r["exchange"] ?? ""),
    type: String(r["instrument_type"] ?? "").toLowerCase(),
    currency: String(r["currency"] ?? "USD"),
  }));
}

/* ------------------------------- fundamentals ------------------------------- */

export type TdStatistics = {
  marketCap: number | null;
  peRatio: number | null;
  forwardPe: number | null;
  eps: number | null;
  dividendYield: number | null;
  beta: number | null;
  profitMargin: number | null;
  revenue: number | null;
  sharesOutstanding: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
};

/** Equity/ETF statistics. Not on every plan — degrades to `null`. */
export async function twelveDataStatistics(symbol: string): Promise<TdStatistics | null> {
  const json = await td<{ statistics?: Record<string, Record<string, unknown>> }>(
    `/statistics?symbol=${encodeURIComponent(symbol)}`,
    { scope: "statistics", ttlMs: 12 * 3_600_000 },
  );
  const s = json?.statistics;
  if (!s) return null;
  const val = s["valuations_metrics"] ?? {};
  const fin = s["financials"] ?? {};
  const stock = s["stock_price_summary"] ?? {};
  const income = (fin["income_statement"] as Record<string, unknown>) ?? {};
  const stats = s["stock_statistics"] ?? {};
  const dividends = s["dividends_and_splits"] ?? {};
  return {
    marketCap: num(val["market_capitalization"]),
    peRatio: num(val["trailing_pe"]),
    forwardPe: num(val["forward_pe"]),
    eps: num(fin["diluted_eps_trailing_twelve_months"]),
    dividendYield: num(dividends["forward_annual_dividend_yield"]),
    beta: num(stock["beta"]),
    profitMargin: num(fin["profit_margin"]),
    revenue: num(income["revenue_ttm"]),
    sharesOutstanding: num(stats["shares_outstanding"]),
    fiftyTwoWeekHigh: num(stock["fifty_two_week_high"]),
    fiftyTwoWeekLow: num(stock["fifty_two_week_low"]),
  };
}

/* --------------------------------- forex ---------------------------------- */

/** Spot rate for a pair like `EUR/USD`. */
export async function twelveDataExchangeRate(pair: string): Promise<number | null> {
  const json = await td<{ rate?: number | string }>(`/exchange_rate?symbol=${encodeURIComponent(pair)}`, {
    scope: "exchange_rate",
    ttlMs: 120_000,
  });
  return num(json?.rate);
}

/* ------------------------------- indicators -------------------------------- */

/**
 * Provider-computed indicator (`rsi`, `macd`, `adx`, `atr`, …). SOLIQ computes
 * its own indicators from bars; this exists for symbols where only Twelve Data
 * answers and we want a cross-check without re-fetching a long series.
 */
export async function twelveDataIndicator(
  indicator: "rsi" | "macd" | "adx" | "atr" | "vwap",
  symbol: string,
  interval: TdInterval = "1day",
): Promise<Record<string, number> | null> {
  const json = await td<{ values?: Record<string, string>[] }>(
    `/${indicator}?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=1`,
    { scope: `indicator:${indicator}`, ttlMs: 15 * 60_000 },
  );
  const first = json?.values?.[0];
  if (!first) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(first)) {
    const n = num(v);
    if (k !== "datetime" && n !== null) out[k] = n;
  }
  return Object.keys(out).length ? out : null;
}

/** Twelve Data symbol conventions per SOLIQ market. */
export function tdSymbol(market: string, symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (market === "crypto") {
    const base = s.replace(/^X:/, "").replace(/[-/]/g, "").replace(/USDT?$/, "");
    return `${base}/USD`;
  }
  if (market === "fx") {
    const pair = s.replace(/^C:/, "").replace(/[-/=X]/g, "");
    return `${pair.slice(0, 3)}/${pair.slice(3, 6)}`;
  }
  if (market === "commodity") return s.includes("/") ? s : `${s}/USD`;
  return s.replace(/^I:/, "");
}
