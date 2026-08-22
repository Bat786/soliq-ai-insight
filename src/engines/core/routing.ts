/**
 * Provider routing table (client-safe data only).
 *
 * Declares, per asset kind and data type, the ORDER in which SOLIQ's existing
 * providers should be asked. It does not fetch anything: adapters feed this
 * order into `firstAvailable()` in `gateway.server.ts`, which already owns
 * caching, metering and fallback. Adding a provider here never replaces one.
 */

import type { ProviderId } from "@/engines/core/types";

export type DataKind =
  | "quote"
  | "candles"
  | "reference"
  | "fundamentals"
  | "indicators"
  | "news"
  | "flow"
  | "onchain"
  | "liquidity"
  | "universe";

export type RouteKind = "stock" | "etf" | "index" | "future" | "fx" | "commodity" | "crypto" | "memecoin" | "stablecoin";

/** Ordered provider preference. First entry wins when it answers. */
const TABLE: Partial<Record<RouteKind, Partial<Record<DataKind, ProviderId[]>>>> = {
  stock: {
    quote: ["massive", "twelvedata", "tape"],
    candles: ["massive", "twelvedata", "tape"],
    reference: ["massive", "twelvedata"],
    fundamentals: ["massive", "twelvedata"],
    indicators: ["massive", "twelvedata"],
    news: ["massive"],
    flow: ["unusual-whales"],
    universe: ["massive"],
  },
  etf: {
    quote: ["massive", "twelvedata", "tape"],
    candles: ["massive", "twelvedata", "tape"],
    reference: ["massive", "twelvedata"],
    fundamentals: ["twelvedata", "massive"],
    flow: ["unusual-whales"],
  },
  index: {
    quote: ["massive", "twelvedata", "tape"],
    candles: ["massive", "twelvedata", "tape"],
  },
  future: {
    quote: ["massive", "twelvedata", "tape"],
    candles: ["massive", "twelvedata", "tape"],
    flow: ["unusual-whales"],
  },
  commodity: {
    quote: ["twelvedata", "massive", "tape"],
    candles: ["twelvedata", "massive", "tape"],
  },
  fx: {
    // Twelve Data's FX coverage is broader than the current Massive plan's.
    quote: ["twelvedata", "massive", "frankfurter", "tape"],
    candles: ["twelvedata", "massive", "tape"],
  },
  crypto: {
    quote: ["massive", "coingecko", "twelvedata"],
    candles: ["massive", "twelvedata", "coingecko"],
    reference: ["coingecko", "massive"],
    universe: ["massive", "coingecko"],
    onchain: ["alchemy", "solana-rpc"],
  },
  memecoin: {
    quote: ["jupiter", "dexscreener", "pumpfun"],
    liquidity: ["dexscreener", "jupiter"],
    reference: ["jupiter", "dexscreener", "coingecko"],
    onchain: ["alchemy", "solana-rpc"],
  },
  stablecoin: {
    quote: ["massive", "coingecko", "twelvedata"],
    reference: ["coingecko", "massive"],
    onchain: ["alchemy", "solana-rpc"],
  },
};

/** Ordered providers for a kind + data type, or an empty list when unrouted. */
export function providerOrder(kind: RouteKind, data: DataKind): ProviderId[] {
  return TABLE[kind]?.[data] ?? [];
}

/** True when the provider is allowed to serve this slice at all. */
export function providerHandles(provider: ProviderId, kind: RouteKind, data: DataKind): boolean {
  return providerOrder(kind, data).includes(provider);
}

/** Human-readable ownership map, used by the data-status surface. */
export const providerLabels: Partial<Record<ProviderId, string>> = {
  massive: "Massive",
  twelvedata: "Twelve Data",
  "unusual-whales": "Unusual Whales",
  jupiter: "Jupiter",
  dexscreener: "DexScreener",
  coingecko: "CoinGecko / GeckoTerminal",
  alchemy: "Alchemy",
  "solana-rpc": "Solana RPC",
  frankfurter: "Frankfurter",
  tape: "Backup tape",
};
