/** Unusual Whales API access + derived whale-flow signals (server only). */

const BASE = "https://api.unusualwhales.com";

export type TidePoint = { t: number; callPrem: number; putPrem: number; netVolume: number };
export type DarkPoolPrint = {
  ticker: string;
  price: number;
  size: number;
  premium: number;
  executedAt: number;
  extendedHours: boolean;
};
export type FlowAlert = {
  id: string;
  ticker: string;
  type: string;
  strike: number;
  expiry: string | null;
  premium: number;
  size: number;
  askSidePrem: number;
  bidSidePrem: number;
  rule: string;
  sector: string | null;
  underlyingPrice: number;
  createdAt: number;
};
export type SectorEtf = {
  ticker: string;
  name: string;
  last: number;
  changePct: number;
  callPremium: number;
  putPremium: number;
  callVolume: number;
  putVolume: number;
  netPremium: number;
  tilt: number;
};
export type NetImpact = { ticker: string; netPremium: number };

export type WhaleSignal = {
  bull: number;
  bear: number;
  tilt: number;
  confidence: number;
  label: string;
  netPremium: number;
  netVolume: number;
  callPremium: number;
  putPremium: number;
  putCallRatio: number;
  headline: string;
};

export type WhaleFeed = {
  tide: TidePoint[];
  signal: WhaleSignal;
  darkpool: DarkPoolPrint[];
  darkpoolTop: { ticker: string; premium: number; prints: number }[];
  alerts: FlowAlert[];
  sectors: SectorEtf[];
  netImpact: { bullish: NetImpact[]; bearish: NetImpact[] };
  updatedAt: number;
  available: boolean;
  error: string | null;
};

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
const TTL = 45_000;

async function uw<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
  const key = process.env["UNUSUAL_WHALES_API_KEY"];
  if (!key) throw new Error("Unusual Whales API key is not configured");

  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  const cacheKey = url.toString();

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;

  const res = await fetch(cacheKey, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) {
    if (hit) return hit.value as T;
    const body = await res.text();
    throw new Error(`Unusual Whales ${path} failed [${res.status}]: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: T };
  const value = (json.data ?? []) as T;
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

function tideSeries(rows: Record<string, unknown>[]): TidePoint[] {
  return rows
    .map((r) => ({
      t: ms(r["timestamp"]),
      callPrem: num(r["net_call_premium"]),
      putPrem: num(r["net_put_premium"]),
      netVolume: num(r["net_volume"]),
    }))
    .sort((a, b) => a.t - b.t);
}

/** Map raw options flow into a 0-100 bull/bear conviction pair. */
export function whaleSignal(tide: TidePoint[], netImpact: NetImpact[]): WhaleSignal {
  const last = tide.at(-1) ?? { t: Date.now(), callPrem: 0, putPrem: 0, netVolume: 0 };
  const callPremium = last.callPrem;
  const putPremium = last.putPrem;
  const netPremium = callPremium - putPremium;
  const gross = Math.abs(callPremium) + Math.abs(putPremium) || 1;

  const premiumTilt = Math.tanh(netPremium / Math.max(1e7, gross * 0.6));
  const volumeTilt = Math.tanh(last.netVolume / 400_000);
  const impactTilt = Math.tanh(
    netImpact.reduce((s, r) => s + r.netPremium, 0) / 1.5e8,
  );
  const tilt = Math.max(-1, Math.min(1, premiumTilt * 0.55 + volumeTilt * 0.25 + impactTilt * 0.2));

  const bull = Math.round(50 + tilt * 50);
  const bear = 100 - bull;
  const label =
    tilt > 0.35 ? "Whales strongly bullish"
    : tilt > 0.12 ? "Whales leaning bullish"
    : tilt < -0.35 ? "Whales strongly bearish"
    : tilt < -0.12 ? "Whales leaning bearish"
    : "Whales neutral";

  const spread = tide.length > 6 ? Math.min(1, tide.length / 78) : 0.35;
  const confidence = Math.round(Math.min(96, 45 + Math.abs(tilt) * 45 * spread + spread * 10));

  const dir = netPremium >= 0 ? "call" : "put";
  const headline = `${dir === "call" ? "Call" : "Put"}-side premium leads by ${fmtBig(Math.abs(netPremium))} with net options volume ${last.netVolume >= 0 ? "+" : ""}${Math.round(last.netVolume).toLocaleString("en-US")}.`;

  return {
    bull,
    bear,
    tilt,
    confidence,
    label,
    netPremium,
    netVolume: last.netVolume,
    callPremium,
    putPremium,
    putCallRatio: Math.abs(callPremium) < 1 ? 0 : Math.abs(putPremium / callPremium),
    headline,
  };
}

function fmtBig(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export async function loadWhaleFeed(): Promise<WhaleFeed> {
  /** Provider/auth failures must degrade to an "unavailable" feed, never throw
   *  (a thrown server function blanks the page for every whale consumer). */
  let failure: string | null = null;
  const soft = async (p: Promise<Record<string, unknown>[]>) => {
    try {
      return await p;
    } catch (e) {
      failure ??= e instanceof Error ? e.message : String(e);
      return [] as Record<string, unknown>[];
    }
  };

  const [tideRaw, darkRaw, alertRaw, sectorRaw, impactRaw] = await Promise.all([
    soft(uw<Record<string, unknown>[]>("/api/market/market-tide")),
    soft(uw<Record<string, unknown>[]>("/api/darkpool/recent", { limit: 200 })),
    soft(uw<Record<string, unknown>[]>("/api/option-trades/flow-alerts", { limit: 60 })),
    soft(uw<Record<string, unknown>[]>("/api/market/sector-etfs")),
    soft(uw<Record<string, unknown>[]>("/api/market/top-net-impact")),
  ]);

  const tide = tideSeries(tideRaw);

  const netImpact = impactRaw.map((r) => ({
    ticker: String(r["ticker"] ?? ""),
    netPremium: num(r["net_premium"]),
  }));

  const darkpool: DarkPoolPrint[] = darkRaw
    .map((r) => ({
      ticker: String(r["ticker"] ?? ""),
      price: num(r["price"]),
      size: num(r["size"]),
      premium: num(r["premium"]),
      executedAt: ms(r["executed_at"]),
      extendedHours: Boolean(r["ext_hour_sold_codes"]),
    }))
    .sort((a, b) => b.premium - a.premium);

  const byTicker = new Map<string, { ticker: string; premium: number; prints: number }>();
  for (const p of darkpool) {
    const row = byTicker.get(p.ticker) ?? { ticker: p.ticker, premium: 0, prints: 0 };
    row.premium += p.premium;
    row.prints += 1;
    byTicker.set(p.ticker, row);
  }

  const alerts: FlowAlert[] = alertRaw.slice(0, 40).map((r) => ({
    id: String(r["id"] ?? `${r["ticker"]}-${r["created_at"]}`),
    ticker: String(r["ticker"] ?? ""),
    type: String(r["type"] ?? (num(r["strike"]) ? "option" : "flow")),
    strike: num(r["strike"]),
    expiry: (r["expiry"] as string | null) ?? null,
    premium: num(r["total_premium"]),
    size: num(r["total_size"]),
    askSidePrem: num(r["total_ask_side_prem"]),
    bidSidePrem: num(r["total_bid_side_prem"]),
    rule: String(r["alert_rule"] ?? "Flow alert"),
    sector: (r["sector"] as string | null) ?? null,
    underlyingPrice: num(r["underlying_price"]),
    createdAt: ms(r["created_at"] ?? r["start_time"]),
  }));

  const sectors: SectorEtf[] = sectorRaw.map((r) => {
    const callPremium = num(r["call_premium"]);
    const putPremium = num(r["put_premium"]);
    const last = num(r["last"]);
    const open = num(r["open"]) || last;
    const net = callPremium - putPremium;
    return {
      ticker: String(r["ticker"] ?? ""),
      name: String(r["full_name"] ?? r["ticker"] ?? ""),
      last,
      changePct: open ? ((last - open) / open) * 100 : 0,
      callPremium,
      putPremium,
      callVolume: num(r["call_volume"]),
      putVolume: num(r["put_volume"]),
      netPremium: net,
      tilt: Math.tanh(net / Math.max(1e6, (callPremium + putPremium) * 0.5)),
    };
  });

  return {
    tide,
    signal: whaleSignal(tide, netImpact),
    darkpool: darkpool.slice(0, 40),
    darkpoolTop: [...byTicker.values()].sort((a, b) => b.premium - a.premium).slice(0, 10),
    alerts,
    sectors,
    netImpact: {
      bullish: netImpact.filter((r) => r.netPremium > 0).slice(0, 10),
      bearish: [...netImpact.filter((r) => r.netPremium < 0)].sort((a, b) => a.netPremium - b.netPremium).slice(0, 10),
    },
    updatedAt: Date.now(),
    available: tide.length > 0,
    error:
      tide.length > 0 ? null
      : /401|authentication/i.test(failure ?? "") ?
        "Unusual Whales rejected the API key (401). Add a valid key to restore institutional flow."
      : (failure ?? "Whale feed unavailable right now."),
  };
}
