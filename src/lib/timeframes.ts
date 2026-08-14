/** Terminal timeframe grid shared by client and server (client-safe). */

export type DeskTf = "1m" | "2m" | "3m" | "5m" | "10m" | "15m" | "30m" | "1h" | "4h" | "1d";

export type TfSpec = {
  id: DeskTf;
  label: string;
  /** Massive aggregate multiplier + span. */
  mult: number;
  span: "minute" | "hour" | "day";
  /** Lookback window in calendar days. */
  days: number;
  /** Cache TTL in ms. */
  ttl: number;
  /** Bucket size in ms (used for resampling fallbacks). */
  ms: number;
  /** Yahoo fallback: base interval + range, resampled up to `ms` when needed. */
  yahoo: { interval: string; range: string };
};

export const deskTimeframes: TfSpec[] = [
  { id: "1m", label: "1m", mult: 1, span: "minute", days: 4, ttl: 40_000, ms: 60_000, yahoo: { interval: "1m", range: "5d" } },
  { id: "2m", label: "2m", mult: 2, span: "minute", days: 6, ttl: 45_000, ms: 120_000, yahoo: { interval: "2m", range: "5d" } },
  { id: "3m", label: "3m", mult: 3, span: "minute", days: 8, ttl: 50_000, ms: 180_000, yahoo: { interval: "1m", range: "5d" } },
  { id: "5m", label: "5m", mult: 5, span: "minute", days: 10, ttl: 60_000, ms: 300_000, yahoo: { interval: "5m", range: "1mo" } },
  { id: "10m", label: "10m", mult: 10, span: "minute", days: 16, ttl: 70_000, ms: 600_000, yahoo: { interval: "5m", range: "1mo" } },
  { id: "15m", label: "15m", mult: 15, span: "minute", days: 20, ttl: 80_000, ms: 900_000, yahoo: { interval: "15m", range: "1mo" } },
  { id: "30m", label: "30m", mult: 30, span: "minute", days: 35, ttl: 90_000, ms: 1_800_000, yahoo: { interval: "30m", range: "3mo" } },
  { id: "1h", label: "1H", mult: 1, span: "hour", days: 70, ttl: 120_000, ms: 3_600_000, yahoo: { interval: "60m", range: "6mo" } },
  { id: "4h", label: "4H", mult: 4, span: "hour", days: 160, ttl: 180_000, ms: 14_400_000, yahoo: { interval: "60m", range: "1y" } },
  { id: "1d", label: "1D", mult: 1, span: "day", days: 500, ttl: 300_000, ms: 86_400_000, yahoo: { interval: "1d", range: "2y" } },
];

export const tfSpec = (id: string): TfSpec =>
  deskTimeframes.find((t) => t.id === id) ?? (deskTimeframes[5] as TfSpec);

export type SymbolMarket = "stocks" | "crypto" | "fx" | "indices" | "futures";

export const marketLabels: Record<SymbolMarket, string> = {
  stocks: "Equity",
  crypto: "Crypto",
  fx: "FX",
  indices: "Index",
  futures: "Futures",
};

/** Route helper: /symbol/stocks/AAPL */
export function symbolPath(market: SymbolMarket, symbol: string) {
  return { to: "/symbol/$market/$symbol" as const, params: { market, symbol: symbol.toUpperCase() } };
}
