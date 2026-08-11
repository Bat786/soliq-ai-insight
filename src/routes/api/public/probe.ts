import { createFileRoute } from "@tanstack/react-router";

/** Temporary upstream probe (dev diagnostics). */
export const Route = createFileRoute("/api/public/probe")({
  server: {
    handlers: {
      GET: async () => {
        const targets: [string, string, Record<string, string>][] = [
          ["yahoo-q1", "https://query1.finance.yahoo.com/v8/finance/chart/NVDA?interval=5m&range=5d", {}],
          ["yahoo-q2", "https://query2.finance.yahoo.com/v8/finance/chart/NVDA?interval=5m&range=5d", {}],
          [
            "yahoo-ua",
            "https://query1.finance.yahoo.com/v8/finance/chart/NVDA?interval=5m&range=5d",
            { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36" },
          ],
          ["binance", "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=5", {}],
          ["stooq", "https://stooq.com/q/l/?s=eurusd&f=sd2t2ohlcv&h&e=csv", {}],
          ["frankfurter", "https://api.frankfurter.dev/v1/latest?base=EUR", {}],
          ["twelve", "https://api.stlouisfed.org/", {}],
        ];
        const out: Record<string, string> = {};
        for (const [name, url, headers] of targets) {
          try {
            const res = await fetch(url, { headers: { Accept: "*/*", ...headers } });
            const text = (await res.text()).slice(0, 120);
            out[name] = `${res.status} ${text.replace(/\s+/g, " ")}`;
          } catch (e) {
            out[name] = `threw ${(e as Error).message}`;
          }
        }
        return Response.json(out);
      },
    },
  },
});
