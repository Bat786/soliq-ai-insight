import { createServerFn } from "@tanstack/react-start";

export const getMarketBoard = createServerFn({ method: "GET" }).handler(async () => {
  const { loadMarketBoard } = await import("@/lib/polygon.server");
  return loadMarketBoard();
});

export const getMarketDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { key: string; interval: "1m" | "5m" | "15m" | "1h" | "4h" }) => ({
    key: String(input.key ?? "").slice(0, 12),
    interval: (["1m", "5m", "15m", "1h", "4h"] as const).includes(input.interval) ? input.interval : "5m",
  }))
  .handler(async ({ data }) => {
    const { loadMarketDetail } = await import("@/lib/polygon.server");
    return loadMarketDetail(data.key, data.interval);
  });
