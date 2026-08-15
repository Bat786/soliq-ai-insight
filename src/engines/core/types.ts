/**
 * SOLIQ normalized market-data model (client-safe).
 *
 * Every provider adapter — Massive/Polygon, Unusual Whales, Jupiter,
 * DexScreener, Pump.fun, Yahoo tape, Alchemy, Solana RPC — normalizes into
 * these shapes so the UI, scanner, flow desk and AETHRON all read one model.
 */

export type AssetKind = "stock" | "etf" | "option" | "future" | "crypto" | "memecoin" | "fx" | "index";

export type ProviderId =
  | "massive"
  | "polygon"
  | "unusual-whales"
  | "jupiter"
  | "dexscreener"
  | "pumpfun"
  | "coingecko"
  | "tape"
  | "frankfurter"
  | "alchemy"
  | "solana-rpc"
  | "supabase"
  | "aethron";

/** Canonical asset identity. */
export type Asset = {
  /** SOLIQ id: `${kind}:${symbol}` (mint address for memecoins). */
  id: string;
  kind: AssetKind;
  symbol: string;
  name: string | null;
  exchange: string | null;
  /** Solana mint / EVM contract, when the asset is on-chain. */
  address?: string | null;
  currency: string;
};

/** Point-in-time price snapshot. */
export type Quote = {
  assetId: string;
  symbol: string;
  price: number;
  change: number | null;
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  volume: number | null;
  /** Exchange/session time of the quote, ms epoch. */
  ts: number;
};

/** OHLCV bar. `t` is the bucket open time in ms epoch. */
export type Candle = { t: number; open: number; high: number; low: number; close: number; volume: number };

/** A single print (tape trade, dark-pool print, DEX swap). */
export type Trade = {
  assetId: string;
  symbol: string;
  price: number;
  size: number;
  ts: number;
  venue: string | null;
  side: "buy" | "sell" | "unknown";
  /** Off-exchange / dark-pool print. */
  darkPool?: boolean;
};

export type VolumeProfile = {
  assetId: string;
  volume: number;
  avgVolume: number | null;
  relVolume: number | null;
  upVolume: number | null;
  downVolume: number | null;
  netFlowPct: number | null;
};

export type MarketEventKind =
  | "news"
  | "options-sweep"
  | "options-block"
  | "unusual-options"
  | "dark-pool-print"
  | "insider-trade"
  | "institutional-change"
  | "short-interest"
  | "halt"
  | "new-token"
  | "signal";

export type MarketEvent = {
  id: string;
  kind: MarketEventKind;
  assetId: string | null;
  symbol: string | null;
  headline: string;
  detail: string | null;
  url: string | null;
  ts: number;
  sentiment: number | null;
  weight: number | null;
};

export type MarketSessionPhase = "premarket" | "regular" | "afterhours" | "overnight" | "closed" | "crypto-24-7";
