import { createServerFn } from "@tanstack/react-start";

const markets = ["stocks", "crypto", "fx", "indices", "futures"] as const;
const tfs = ["1m", "2m", "3m", "5m", "10m", "15m", "30m", "1h", "4h", "1d"] as const;

/** Everything for one ticker/token/pair/contract at one timeframe. */
export const getSymbolDashboard = createServerFn({ method: "GET" })
  .inputValidator((input: { market: string; symbol: string; timeframe: string }) => ({
    market: (markets as readonly string[]).includes(input?.market) ? (input.market as (typeof markets)[number]) : "stocks",
    symbol: String(input?.symbol ?? "").slice(0, 16),
    timeframe: (tfs as readonly string[]).includes(input?.timeframe) ? (input.timeframe as (typeof tfs)[number]) : "5m",
  }))
  .handler(async ({ data }) => {
    const { loadSymbolDashboard } = await import("@/lib/symbol.server");
    return loadSymbolDashboard(data.market, data.symbol, data.timeframe);
  });

/** Ticker autocomplete across every desk. */
export const searchAllSymbols = createServerFn({ method: "GET" })
  .inputValidator((input: { q: string }) => ({ q: String(input?.q ?? "").slice(0, 32) }))
  .handler(async ({ data }) => {
    if (data.q.trim().length < 1) return [];
    const { searchSymbols } = await import("@/lib/tape.server");
    return searchSymbols(data.q).catch(() => []);
  });
