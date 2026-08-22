/**
 * Data status probe — server only.
 *
 * Reports what each upstream provider is actually serving us right now, so the
 * desk can show an honest "live / delayed / not entitled" badge instead of
 * silently degrading.
 */

import { massiveStatus, massiveGet } from "@/lib/massive.server";
import { snaptradeApiStatus } from "@/lib/snaptrade.server";

export type ProviderState = "live" | "degraded" | "unentitled" | "missing-key";

export type ProviderStatus = {
  id: string;
  name: string;
  state: ProviderState;
  detail: string;
  /** What the app uses instead when this feed is unavailable. */
  fallback: string | null;
};

export type DataStatus = {
  checkedAt: string;
  massive: ReturnType<typeof massiveStatus> & {
    realtimeSnapshots: boolean;
    minuteBars: boolean;
  };
  providers: ProviderStatus[];
};

const hasEnv = (...names: string[]) => names.some((n) => Boolean(process.env[n]));

const isoDay = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

/** Probe the two entitlements that decide how fresh the tape can be. */
async function probeMassive() {
  const snapshot = await massiveGet<{ ticker?: unknown }>(
    "/v2/snapshot/locale/us/markets/stocks/tickers/AAPL",
    { ttl: 5 * 60_000, scope: "probe:snapshot" },
  );
  const minute = await massiveGet<{ results?: unknown[] }>(
    `/v2/aggs/ticker/AAPL/range/1/minute/${isoDay(4)}/${isoDay(0)}?adjusted=true&sort=desc&limit=1`,
    { ttl: 5 * 60_000, scope: "probe:minute" },
  );
  return {
    realtimeSnapshots: Boolean(snapshot?.ticker),
    minuteBars: Boolean(minute?.results?.length),
  };
}

export async function collectDataStatus(): Promise<DataStatus> {
  const [probe, snaptrade] = await Promise.all([probeMassive(), snaptradeApiStatus()]);
  const base = massiveStatus();

  const massiveState: ProviderState = !base.configured
    ? "missing-key"
    : probe.minuteBars
      ? "live"
      : base.unentitled.length
        ? "unentitled"
        : "degraded";

  const providers: ProviderStatus[] = [
    {
      id: "massive",
      name: "Massive (stocks, FX, indices, crypto bars)",
      state: massiveState,
      detail: probe.minuteBars
        ? probe.realtimeSnapshots
          ? "Minute bars and real-time snapshots authenticated."
          : "Minute bars authenticated. Real-time snapshots are not in the plan."
        : base.configured
          ? "Minute bars unavailable — daily aggregates only."
          : "No API key configured.",
      fallback: probe.realtimeSnapshots ? null : "Latest minute/daily bar close is used as the live price.",
    },
    {
      id: "twelvedata",
      name: "Twelve Data (stocks, ETFs, FX, commodities, crypto)",
      state: hasEnv("TWELVE_DATA_API_KEY") ? "live" : "missing-key",
      detail: hasEnv("TWELVE_DATA_API_KEY")
        ? "Secondary market feed — batched quotes and time series on a free-plan request budget."
        : "No API key configured.",
      fallback: "Massive first, backup tape last — Twelve Data is never the only source for a symbol.",
    },
    {

      id: "coingecko",
      name: "CoinGecko (crypto prices, market caps)",
      state: hasEnv("COINGECKO_API_KEY") ? "live" : "degraded",
      detail: hasEnv("COINGECKO_API_KEY") ? "Keyed access." : "Public tier — lower rate limit.",
      fallback: "GeckoTerminal and DexScreener pools.",
    },
    {
      id: "jupiter",
      name: "Jupiter (Solana routing and quotes)",
      state: hasEnv("JUPITER_API_KEY") ? "live" : "degraded",
      detail: hasEnv("JUPITER_API_KEY") ? "Keyed access." : "Public endpoints.",
      fallback: "DexScreener pair pricing.",
    },
    {
      id: "dexscreener",
      name: "DexScreener (DEX pairs and liquidity)",
      state: "live",
      detail: "Keyless public API.",
      fallback: null,
    },
    {
      id: "alchemy",
      name: "Alchemy (EVM + Solana RPC, wallet balances)",
      state: hasEnv("ALCHEMY_API_KEY") ? "live" : "missing-key",
      detail: hasEnv("ALCHEMY_API_KEY") ? "Keyed RPC access." : "No key — wallet balances stay empty.",
      fallback: "Public RPC endpoints (rate limited).",
    },
    {
      id: "unusual-whales",
      name: "Unusual Whales (options flow, dark pool)",
      state: hasEnv("UNUSUAL_WHALES_API_KEY") ? "live" : "missing-key",
      detail: hasEnv("UNUSUAL_WHALES_API_KEY") ? "Keyed access." : "No key — flow feed disabled.",
      fallback: "Massive aggregates only.",
    },
    {
      id: "snaptrade",
      name: "SnapTrade (brokerage accounts)",
      state: !hasEnv("SNAPTRADE_CLIENT_ID")
        ? "missing-key"
        : snaptrade.online
          ? "live"
          : "degraded",
      detail: !hasEnv("SNAPTRADE_CLIENT_ID")
        ? "No credentials configured."
        : snaptrade.online
          ? `SnapTrade API online · v${snaptrade.version ?? "?"}${
              snaptrade.timestamp ? ` · reported ${new Date(snaptrade.timestamp).toISOString().slice(11, 19)}Z` : ""
            }`
          : "SnapTrade API is not responding to its status probe.",
      fallback: snaptrade.online ? null : "Manual portfolio entry.",
    },

  ];

  return { checkedAt: new Date().toISOString(), massive: { ...base, ...probe }, providers };
}
