export const deskIds = ["fx", "futures", "stocks", "crypto", "indices"] as const;
export const tapeIntervals = ["1m", "5m", "15m", "1h", "4h"] as const;

export type TapeDeskId = (typeof deskIds)[number];
export type TapeInterval = (typeof tapeIntervals)[number];
