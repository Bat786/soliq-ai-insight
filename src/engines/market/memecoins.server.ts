/**
 * SOLIQ Market Engine — Solana memecoin discovery (server only).
 *
 * Keyless public endpoints, all read-only: DEX Screener token profiles and
 * boosted feeds for freshly surfaced tokens, Pump.fun's public coin feed for
 * launch-stage discovery, and Jupiter for tradability. Everything runs through
 * the shared gateway (cache + rate budget + retry) and returns envelopes, so an
 * unreachable feed reports `unavailable` rather than fabricating tokens.
 */

import { freshness, type DataEnvelope } from "@/engines/core/envelope";
import { firstAvailable, getJson } from "@/engines/core/gateway.server";

export type MemecoinRow = {
  /** SOLIQ asset id: `memecoin:<mint>`. */
  id: string;
  mint: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  changePct24h: number | null;
  volume24h: number | null;
  liquidityUsd: number | null;
  marketCap: number | null;
  buys24h: number | null;
  sells24h: number | null;
  createdAt: number | null;
  url: string | null;
  image: string | null;
  venue: string | null;
};

type DsPair = {
  chainId?: string;
  baseToken?: { address?: string; symbol?: string; name?: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
  txns?: { h24?: { buys?: number; sells?: number } };
  pairCreatedAt?: number;
  url?: string;
  dexId?: string;
  info?: { imageUrl?: string };
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

function fromDexScreener(pairs: DsPair[]): MemecoinRow[] {
  return pairs
    .filter((p) => (p.chainId ?? "solana") === "solana" && p.baseToken?.address)
    .map((p) => ({
      id: `memecoin:${p.baseToken?.address}`,
      mint: String(p.baseToken?.address),
      symbol: (p.baseToken?.symbol ?? "?").toUpperCase(),
      name: p.baseToken?.name ?? p.baseToken?.symbol ?? "Unknown token",
      priceUsd: num(p.priceUsd),
      changePct24h: num(p.priceChange?.h24),
      volume24h: num(p.volume?.h24),
      liquidityUsd: num(p.liquidity?.usd),
      marketCap: num(p.marketCap ?? p.fdv),
      buys24h: num(p.txns?.h24?.buys),
      sells24h: num(p.txns?.h24?.sells),
      createdAt: num(p.pairCreatedAt),
      url: p.url ?? null,
      image: p.info?.imageUrl ?? null,
      venue: p.dexId ?? "dexscreener",
    }))
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
}

/** Momentum board: Solana pairs with the strongest live traded volume. */
export async function memecoinMomentum(limit = 40): Promise<DataEnvelope<MemecoinRow[]>> {
  return firstAvailable<MemecoinRow[]>(
    [
      {
        provider: "dexscreener",
        label: "DEX Screener · Solana pairs",
        key: "meme:momentum:dexscreener",
        ttlMs: 45_000,
        load: async () => {
          const res = await getJson<{ pairs?: DsPair[] }>(
            "https://api.dexscreener.com/latest/dex/search?q=solana%20SOL",
          );
          const rows = fromDexScreener(res?.pairs ?? []);
          return rows.length ? rows.slice(0, limit) : null;
        },
        accept: (rows) => rows.length > 0,
      },
    ],
    { policy: freshness.intraday, unavailableReason: "The Solana DEX feed did not answer." },
  );
}

type PumpCoin = {
  mint?: string;
  symbol?: string;
  name?: string;
  usd_market_cap?: number;
  market_cap?: number;
  created_timestamp?: number;
  image_uri?: string;
  complete?: boolean;
};

/** Launch-stage discovery: newly created Pump.fun coins, falling back to fresh DEX pairs. */
export async function newTokenDiscovery(limit = 30): Promise<DataEnvelope<MemecoinRow[]>> {
  return firstAvailable<MemecoinRow[]>(
    [
      {
        provider: "pumpfun",
        label: "Pump.fun · new coins",
        key: "meme:new:pumpfun",
        ttlMs: 30_000,
        load: async () => {
          const res = await getJson<PumpCoin[]>(
            `https://frontend-api.pump.fun/coins?offset=0&limit=${limit}&sort=created_timestamp&order=DESC&includeNsfw=false`,
          );
          if (!Array.isArray(res) || !res.length) return null;
          return res
            .filter((c) => c.mint)
            .map<MemecoinRow>((c) => ({
              id: `memecoin:${c.mint}`,
              mint: String(c.mint),
              symbol: (c.symbol ?? "?").toUpperCase(),
              name: c.name ?? c.symbol ?? "New token",
              priceUsd: null,
              changePct24h: null,
              volume24h: null,
              liquidityUsd: null,
              marketCap: num(c.usd_market_cap ?? c.market_cap),
              buys24h: null,
              sells24h: null,
              createdAt: num(c.created_timestamp),
              url: `https://pump.fun/${c.mint}`,
              image: c.image_uri ?? null,
              venue: "pump.fun",
            }));
        },
        accept: (rows) => rows.length > 0,
      },
      {
        provider: "dexscreener",
        label: "DEX Screener · newest Solana pairs",
        key: "meme:new:dexscreener",
        ttlMs: 45_000,
        load: async () => {
          const res = await getJson<{ pairs?: DsPair[] }>("https://api.dexscreener.com/latest/dex/search?q=SOL");
          const rows = fromDexScreener(res?.pairs ?? [])
            .filter((r) => r.createdAt)
            .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
          return rows.length ? rows.slice(0, limit) : null;
        },
        accept: (rows) => rows.length > 0,
      },
    ],
    { policy: freshness.intraday, unavailableReason: "No launch feed answered for new Solana tokens." },
  );
}
