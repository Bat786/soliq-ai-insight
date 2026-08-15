/**
 * CoinGecko + GeckoTerminal client (server-only).
 *
 * The project key is a Demo key (`CG-…`), so the Demo base URL and the
 * `x-cg-demo-api-key` header are hard-coded per CoinGecko's rules. Requests are
 * cached and metered through the shared gateway so we stay inside 30 calls/min.
 */

import { fetchProvider, getJson } from "@/engines/core/gateway.server";

const BASE = "https://api.coingecko.com/api/v3";

function headers(): Record<string, string> {
  const key = process.env["COINGECKO_API_KEY"];
  return { accept: "application/json", ...(key ? { "x-cg-demo-api-key": key } : {}) };
}

/** Raw keyed GET against CoinGecko. Throws on provider failure. */
export async function cgGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${(await res.text()).slice(0, 180)}`);
  return (await res.json()) as T;
}

/** Cached + rate-metered GET. Returns null instead of throwing. */
export async function cgCached<T>(path: string, ttlMs: number): Promise<T | null> {
  const hit = await fetchProvider<T>({
    provider: "coingecko",
    key: `cg:${path}`,
    ttlMs,
    load: () => getJson<T>(`${BASE}${path}`, { headers: headers() }),
  });
  return hit ? hit.value : null;
}

/* ------------------------------ aggregated ------------------------------ */

export type CgTrendingCoin = {
  id: string;
  symbol: string;
  name: string;
  thumb: string | null;
  marketCapRank: number | null;
  price: number;
  change24h: number;
  volume24h: number;
};

export async function cgTrending(): Promise<CgTrendingCoin[]> {
  const raw = await cgCached<{ coins?: unknown[] }>("/search/trending", 120_000);
  const coins = Array.isArray(raw?.coins) ? raw.coins : [];
  return coins.slice(0, 12).map((entry) => {
    const item = ((entry as Record<string, unknown>)["item"] ?? {}) as Record<string, unknown>;
    const d = (item["data"] ?? {}) as Record<string, unknown>;
    const chg = (d["price_change_percentage_24h"] ?? {}) as Record<string, unknown>;
    return {
      id: String(item["id"] ?? ""),
      symbol: String(item["symbol"] ?? "").toUpperCase(),
      name: String(item["name"] ?? ""),
      thumb: typeof item["thumb"] === "string" ? item["thumb"] : null,
      marketCapRank: typeof item["market_cap_rank"] === "number" ? item["market_cap_rank"] : null,
      price: Number(d["price"]) || 0,
      change24h: Number(chg["usd"]) || 0,
      volume24h: Number(String(d["total_volume"] ?? "0").replace(/[^0-9.]/g, "")) || 0,
    };
  });
}

export type CgMover = { id: string; symbol: string; name: string; price: number; change24h: number; volume24h: number };

function toMover(raw: unknown): CgMover {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(c["id"] ?? ""),
    symbol: String(c["symbol"] ?? "").toUpperCase(),
    name: String(c["name"] ?? ""),
    price: Number(c["usd"] ?? c["current_price"]) || 0,
    change24h: Number(c["usd_24h_change"] ?? c["price_change_percentage_24h"]) || 0,
    volume24h: Number(c["usd_24h_vol"] ?? c["total_volume"]) || 0,
  };
}

/** Top gainers / losers over 24h (Demo plan may gate this; returns empty then). */
export async function cgTopMovers(): Promise<{ gainers: CgMover[]; losers: CgMover[] }> {
  const raw = await cgCached<{ top_gainers?: unknown[]; top_losers?: unknown[] }>(
    "/coins/top_gainers_losers?vs_currency=usd&duration=24h",
    180_000,
  );
  return {
    gainers: (raw?.top_gainers ?? []).slice(0, 12).map(toMover),
    losers: (raw?.top_losers ?? []).slice(0, 12).map(toMover),
  };
}

/** OHLC candles for a CoinGecko coin id. `[t, o, h, l, c]` tuples. */
export async function cgOhlc(id: string, days: number): Promise<[number, number, number, number, number][]> {
  const raw = await cgCached<[number, number, number, number, number][]>(
    `/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`,
    120_000,
  );
  return Array.isArray(raw) ? raw : [];
}

/** Resolve a query to CoinGecko coin ids (never guess ids). */
export async function cgSearch(query: string): Promise<{ id: string; symbol: string; name: string }[]> {
  const raw = await cgCached<{ coins?: Record<string, unknown>[] }>(
    `/search?query=${encodeURIComponent(query)}`,
    300_000,
  );
  return (raw?.coins ?? []).slice(0, 15).map((c) => ({
    id: String(c["id"] ?? ""),
    symbol: String(c["symbol"] ?? "").toUpperCase(),
    name: String(c["name"] ?? ""),
  }));
}

/* ---------------------------- GeckoTerminal ---------------------------- */

export type OnchainPool = {
  address: string;
  name: string;
  dex: string;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  liquidity: number;
  fdv: number;
  createdAt: number;
  buys24h: number;
  sells24h: number;
};

function toPool(raw: unknown): OnchainPool {
  const p = (raw ?? {}) as Record<string, unknown>;
  const a = (p["attributes"] ?? {}) as Record<string, unknown>;
  const rel = (p["relationships"] ?? {}) as Record<string, unknown>;
  const dex = (((rel["dex"] ?? {}) as Record<string, unknown>)["data"] ?? {}) as Record<string, unknown>;
  const chg = (a["price_change_percentage"] ?? {}) as Record<string, unknown>;
  const vol = (a["volume_usd"] ?? {}) as Record<string, unknown>;
  const liq = a["reserve_in_usd"];
  const tx = ((a["transactions"] ?? {}) as Record<string, unknown>)["h24"] as Record<string, unknown> | undefined;
  return {
    address: String(a["address"] ?? ""),
    name: String(a["name"] ?? ""),
    dex: String(dex["id"] ?? ""),
    priceUsd: Number(a["base_token_price_usd"]) || 0,
    change24h: Number(chg["h24"]) || 0,
    volume24h: Number(vol["h24"]) || 0,
    liquidity: Number(liq) || 0,
    fdv: Number(a["fdv_usd"]) || 0,
    createdAt: Date.parse(String(a["pool_created_at"] ?? "")) || 0,
    buys24h: Number(tx?.["buys"]) || 0,
    sells24h: Number(tx?.["sells"]) || 0,
  };
}

/** Trending on-chain pools for a network (default Solana). */
export async function gtTrendingPools(network = "solana"): Promise<OnchainPool[]> {
  const raw = await cgCached<{ data?: unknown[] }>(
    `/onchain/networks/${network}/trending_pools?page=1`,
    90_000,
  );
  return (raw?.data ?? []).slice(0, 20).map(toPool);
}

/** Newest on-chain pools for a network — launch-stage discovery. */
export async function gtNewPools(network = "solana"): Promise<OnchainPool[]> {
  const raw = await cgCached<{ data?: unknown[] }>(`/onchain/networks/${network}/new_pools?page=1`, 60_000);
  return (raw?.data ?? []).slice(0, 20).map(toPool);
}

/** On-chain token price by contract/mint address. */
export async function gtTokenPrice(address: string, network = "solana"): Promise<number | null> {
  const raw = await cgCached<{ data?: { attributes?: { token_prices?: Record<string, string> } } }>(
    `/onchain/simple/networks/${network}/token_price/${address}`,
    60_000,
  );
  const prices = raw?.data?.attributes?.token_prices ?? {};
  const first = Object.values(prices)[0];
  return first ? Number(first) || null : null;
}
