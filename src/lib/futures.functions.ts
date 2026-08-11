import { createServerFn } from "@tanstack/react-start";

export const getFuturesBoard = createServerFn({ method: "GET" }).handler(async () => {
  const { loadFuturesBoard } = await import("@/lib/futures.server");
  return loadFuturesBoard();
});

export const getTickerDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { symbol: string; interval: "1m" | "5m" | "15m" | "1h" | "4h" }) => ({
    symbol: String(input.symbol ?? "").slice(0, 12),
    interval: (["1m", "5m", "15m", "1h", "4h"] as const).includes(input.interval) ? input.interval : "5m",
  }))
  .handler(async ({ data }) => {
    const { loadTickerDetail } = await import("@/lib/futures.server");
    return loadTickerDetail(data.symbol, data.interval);
  });
