export const deskIds = ["fx", "futures", "stocks", "crypto", "indices"] as const;
export const tapeIntervals = ["1m", "5m", "15m", "1h", "4h"] as const;

export type TapeDeskId = (typeof deskIds)[number];
export type TapeInterval = (typeof tapeIntervals)[number];

/** Which feed produced the series a row was scored from (client-safe). */
export type MarketSource =
  | "massive"
  | "twelvedata"
  | "tape"
  | "binance"
  | "frankfurter"
  | "proxy"
  | "none";

export const sourceLabels: Record<MarketSource, string> = {
  massive: "Massive",
  twelvedata: "Twelve Data",
  tape: "Backup tape",
  binance: "Binance spot",
  frankfurter: "ECB (Frankfurter)",
  proxy: "ETF proxy",
  none: "No feed",
};
