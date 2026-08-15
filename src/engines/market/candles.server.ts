/**
 * SOLIQ Market Engine — candles service (server only).
 *
 * Wraps the existing Massive and keyless-tape adapters behind the gateway so
 * every bar request shares one cache, one rate budget, ordered fallback and a
 * DataEnvelope carrying source + freshness. No synthetic bars, ever: when no
 * provider answers the slice is reported `unavailable`.
 */

import { freshness, type DataEnvelope } from "@/engines/core/envelope";
import { firstAvailable } from "@/engines/core/gateway.server";
import type { Candle } from "@/engines/core/types";
import { resample } from "@/lib/futures.server";
import { massiveCustomBars, type AssetClass } from "@/lib/massive.server";
import { loadBars } from "@/lib/tape.server";
import { tfSpec, type DeskTf, type SymbolMarket } from "@/lib/timeframes";

export const assetClassFor = (market: SymbolMarket): AssetClass =>
  market === "crypto" ? "crypto" : market === "fx" ? "fx" : market === "indices" ? "indices" : "stocks";

const baseMsOf = (interval: string) =>
  interval.endsWith("m") ? Number(interval.replace("m", "")) * 60_000 : interval === "60m" ? 3_600_000 : 86_400_000;

/** Bars for one symbol at one timeframe, with provenance and freshness. */
export async function candles(
  market: SymbolMarket,
  upstreamSymbol: string,
  yahooSymbol: string,
  tf: DeskTf,
): Promise<DataEnvelope<Candle[]>> {
  const spec = tfSpec(tf);
  const policy = tf === "1d" ? freshness.daily : freshness.intraday;

  return firstAvailable<Candle[]>(
    [
      {
        provider: "massive",
        label: "Massive aggregates",
        key: `candles:massive:${market}:${upstreamSymbol}:${tf}`,
        ttlMs: spec.ttl,
        load: () => massiveCustomBars(assetClassFor(market), upstreamSymbol, tf),
        accept: (bars) => bars.length > 8,
      },
      {
        provider: "tape",
        label: "Backup tape",
        key: `candles:tape:${yahooSymbol}:${tf}`,
        ttlMs: spec.ttl,
        load: async () => {
          const raw = await loadBars(yahooSymbol, { interval: spec.yahoo.interval, range: spec.yahoo.range });
          if (!raw.length) return null;
          return spec.ms > baseMsOf(spec.yahoo.interval) ? resample(raw, spec.ms) : raw;
        },
        accept: (bars) => bars.length > 4,
      },
    ],
    { policy, unavailableReason: "No bar feed is entitled for this symbol at the selected timeframe." },
  );
}
