/**
 * Equity research layer — server only.
 *
 * Fundamentals, balance sheet, income statement, corporate profile, dividends
 * and live options chains, all sourced from the Massive (polygon.io) REST API
 * with the same key the tape uses. Every helper degrades to null/[] instead of
 * throwing so the UI can label a slice as unavailable on the plan.
 */

const BASE = "https://api.polygon.io";

type Entry = { at: number; value: unknown };
const cache = new Map<string, Entry>();

function key(): string | null {
  const raw = process.env["MASSIVE_API_KEY"] ?? process.env["POLYGON_API_KEY"];
  return raw ? raw.replace(/\s+/g, "") : null;
}

async function get<T>(path: string, ttl = 10 * 60_000): Promise<T | null> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  const k = key();
  if (!k) return (hit?.value as T) ?? null;
  const sep = path.includes("?") ? "&" : "?";
  try {
    const res = await fetch(`${BASE}${path}${sep}apiKey=${k}`, { headers: { Accept: "application/json" } });
    const json = (await res.json()) as { status?: string };
    if (!res.ok || json.status === "NOT_AUTHORIZED" || json.status === "ERROR") return (hit?.value as T) ?? null;
    cache.set(path, { at: Date.now(), value: json });
    return json as T;
  } catch {
    return (hit?.value as T) ?? null;
  }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/* --------------------------------- profile -------------------------------- */

export type CompanyProfile = {
  ticker: string;
  name: string;
  description: string | null;
  exchange: string | null;
  sic: string | null;
  employees: number | null;
  marketCap: number | null;
  shares: number | null;
  homepage: string | null;
  logo: string | null;
  listDate: string | null;
  currency: string | null;
};

export async function loadProfile(ticker: string): Promise<CompanyProfile | null> {
  const t = ticker.trim().toUpperCase();
  const json = await get<{ results?: Record<string, unknown> }>(`/v3/reference/tickers/${encodeURIComponent(t)}`, 60 * 60_000);
  const r = json?.results;
  if (!r) return null;
  const branding = r["branding"] as Record<string, string> | undefined;
  return {
    ticker: t,
    name: String(r["name"] ?? t),
    description: (r["description"] as string) ?? null,
    exchange: (r["primary_exchange"] as string) ?? null,
    sic: (r["sic_description"] as string) ?? null,
    employees: num(r["total_employees"]),
    marketCap: num(r["market_cap"]),
    shares: num(r["weighted_shares_outstanding"]) ?? num(r["share_class_shares_outstanding"]),
    homepage: (r["homepage_url"] as string) ?? null,
    logo: branding?.["icon_url"] ?? null,
    listDate: (r["list_date"] as string) ?? null,
    currency: (r["currency_name"] as string) ?? null,
  };
}

/* ------------------------------- financials ------------------------------- */

export type FinancialPeriod = {
  period: string;
  fiscalYear: string;
  end: string;
  revenue: number | null;
  netIncome: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  eps: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  cashFlow: number | null;
};

type FinRow = {
  fiscal_period?: string;
  fiscal_year?: string;
  end_date?: string;
  financials?: Record<string, Record<string, { value?: number }>>;
};

const cell = (f: FinRow["financials"], stmt: string, field: string) =>
  num(f?.[stmt]?.[field]?.value);

export async function loadFinancials(ticker: string, timeframe: "quarterly" | "annual" = "quarterly"): Promise<FinancialPeriod[]> {
  const t = ticker.trim().toUpperCase();
  const json = await get<{ results?: FinRow[] }>(
    `/vX/reference/financials?ticker=${encodeURIComponent(t)}&timeframe=${timeframe}&limit=8&order=desc&sort=period_of_report_date`,
    30 * 60_000,
  );
  return (json?.results ?? []).map((r) => {
    const f = r.financials;
    return {
      period: String(r.fiscal_period ?? ""),
      fiscalYear: String(r.fiscal_year ?? ""),
      end: String(r.end_date ?? ""),
      revenue: cell(f, "income_statement", "revenues"),
      netIncome: cell(f, "income_statement", "net_income_loss"),
      grossProfit: cell(f, "income_statement", "gross_profit"),
      operatingIncome: cell(f, "income_statement", "operating_income_loss"),
      eps: cell(f, "income_statement", "basic_earnings_per_share"),
      assets: cell(f, "balance_sheet", "assets"),
      liabilities: cell(f, "balance_sheet", "liabilities"),
      equity: cell(f, "balance_sheet", "equity"),
      cashFlow: cell(f, "cash_flow_statement", "net_cash_flow"),
    };
  });
}

/* ---------------------------------- options -------------------------------- */

export type OptionContract = {
  ticker: string;
  type: "call" | "put";
  strike: number;
  expiry: string;
  last: number | null;
  bid: number | null;
  ask: number | null;
  volume: number;
  openInterest: number;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  breakEven: number | null;
};

export type OptionsChain = {
  underlying: string;
  spot: number | null;
  expiries: string[];
  contracts: OptionContract[];
  callVolume: number;
  putVolume: number;
  callOi: number;
  putOi: number;
  putCallRatio: number | null;
  available: boolean;
};

type SnapRow = {
  details?: { contract_type?: string; strike_price?: number; expiration_date?: string; ticker?: string };
  day?: { close?: number; volume?: number };
  last_quote?: { bid?: number; ask?: number };
  greeks?: { delta?: number; gamma?: number; theta?: number };
  implied_volatility?: number;
  open_interest?: number;
  break_even_price?: number;
  underlying_asset?: { price?: number };
};

export async function loadOptionsChain(underlying: string): Promise<OptionsChain> {
  const u = underlying.trim().toUpperCase();
  const json = await get<{ results?: SnapRow[] }>(
    `/v3/snapshot/options/${encodeURIComponent(u)}?limit=250&order=asc&sort=expiration_date`,
    3 * 60_000,
  );
  const rows = json?.results ?? [];
  let spot: number | null = null;
  const contracts: OptionContract[] = [];
  for (const r of rows) {
    const d = r.details;
    if (!d?.contract_type || !d.strike_price || !d.expiration_date) continue;
    spot = spot ?? num(r.underlying_asset?.price);
    contracts.push({
      ticker: String(d.ticker ?? ""),
      type: d.contract_type === "put" ? "put" : "call",
      strike: d.strike_price,
      expiry: d.expiration_date,
      last: num(r.day?.close),
      bid: num(r.last_quote?.bid),
      ask: num(r.last_quote?.ask),
      volume: num(r.day?.volume) ?? 0,
      openInterest: num(r.open_interest) ?? 0,
      iv: num(r.implied_volatility),
      delta: num(r.greeks?.delta),
      gamma: num(r.greeks?.gamma),
      theta: num(r.greeks?.theta),
      breakEven: num(r.break_even_price),
    });
  }
  const calls = contracts.filter((c) => c.type === "call");
  const puts = contracts.filter((c) => c.type === "put");
  const sum = (list: OptionContract[], f: (c: OptionContract) => number) => list.reduce((s, c) => s + f(c), 0);
  const callVolume = sum(calls, (c) => c.volume);
  const putVolume = sum(puts, (c) => c.volume);
  return {
    underlying: u,
    spot,
    expiries: [...new Set(contracts.map((c) => c.expiry))].sort(),
    contracts,
    callVolume,
    putVolume,
    callOi: sum(calls, (c) => c.openInterest),
    putOi: sum(puts, (c) => c.openInterest),
    putCallRatio: callVolume > 0 ? Number((putVolume / callVolume).toFixed(2)) : null,
    available: contracts.length > 0,
  };
}

/* ------------------------------ research bundle ---------------------------- */

export type EquityResearch = {
  profile: CompanyProfile | null;
  quarterly: FinancialPeriod[];
  annual: FinancialPeriod[];
  options: OptionsChain;
  notes: string[];
};

export async function loadEquityResearch(ticker: string): Promise<EquityResearch> {
  const [profile, quarterly, annual, options] = await Promise.all([
    loadProfile(ticker).catch(() => null),
    loadFinancials(ticker, "quarterly").catch(() => []),
    loadFinancials(ticker, "annual").catch(() => []),
    loadOptionsChain(ticker).catch(
      () =>
        ({
          underlying: ticker.toUpperCase(),
          spot: null,
          expiries: [],
          contracts: [],
          callVolume: 0,
          putVolume: 0,
          callOi: 0,
          putOi: 0,
          putCallRatio: null,
          available: false,
        }) satisfies OptionsChain,
    ),
  ]);
  const notes: string[] = [];
  if (!profile) notes.push("Corporate profile unavailable for this symbol.");
  if (!quarterly.length && !annual.length) notes.push("Filed financial statements are not available on the current data plan.");
  if (!options.available) notes.push("Live options chain is not available for this symbol on the current data plan.");
  return { profile, quarterly, annual, options, notes };
}

/* -------------------------------- universe -------------------------------- */

export type UniverseRow = { ticker: string; name: string; exchange: string; type: string };

/** Every actively traded listed ticker, paged from Massive reference data. */
export async function loadUniverse(search?: string, limit = 200): Promise<UniverseRow[]> {
  const q = search?.trim();
  const path = `/v3/reference/tickers?market=stocks&active=true&limit=${Math.min(limit, 1000)}&order=asc&sort=ticker${
    q ? `&search=${encodeURIComponent(q)}` : ""
  }`;
  const json = await get<{ results?: Record<string, unknown>[] }>(path, 15 * 60_000);
  return (json?.results ?? []).map((r) => ({
    ticker: String(r["ticker"] ?? ""),
    name: String(r["name"] ?? ""),
    exchange: String(r["primary_exchange"] ?? ""),
    type: String(r["type"] ?? "CS"),
  }));
}

/* ----------------------------- short interest ----------------------------- */

export type ShortInterest = {
  settlementDate: string;
  shortVolume: number | null;
  shortInterest: number | null;
  daysToCover: number | null;
  avgDailyVolume: number | null;
};

/** Latest reported short interest / short volume rows (plan dependent). */
export async function loadShortInterest(ticker: string): Promise<ShortInterest[]> {
  const t = ticker.trim().toUpperCase();
  const json = await get<{ results?: Record<string, unknown>[] }>(
    `/stocks/vX/short-interest?ticker=${encodeURIComponent(t)}&limit=6&order=desc&sort=settlement_date`,
    6 * 60 * 60_000,
  );
  return (json?.results ?? []).map((r) => ({
    settlementDate: String(r["settlement_date"] ?? ""),
    shortVolume: num(r["short_volume"]),
    shortInterest: num(r["short_interest"]),
    daysToCover: num(r["days_to_cover"]),
    avgDailyVolume: num(r["avg_daily_volume"]),
  }));
}

export type FloatStats = {
  shares: number | null;
  float: number | null;
  freeFloatPct: number | null;
  shortPctFloat: number | null;
  daysToCover: number | null;
  marketCap: number | null;
};

/** Float / short-squeeze mechanics assembled from reference + short interest. */
export async function loadFloatStats(ticker: string): Promise<FloatStats> {
  const [profile, shorts] = await Promise.all([
    loadProfile(ticker).catch(() => null),
    loadShortInterest(ticker).catch(() => [] as ShortInterest[]),
  ]);
  const latest = shorts[0];
  const shares = profile?.shares ?? null;
  const si = latest?.shortInterest ?? null;
  return {
    shares,
    float: shares,
    freeFloatPct: null,
    shortPctFloat: shares && si ? Number(((si / shares) * 100).toFixed(2)) : null,
    daysToCover: latest?.daysToCover ?? null,
    marketCap: profile?.marketCap ?? null,
  };
}
