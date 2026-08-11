import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/diag")({
  server: {
    handlers: {
      GET: async () => {
        const key = (process.env["MASSIVE_API_KEY"] ?? process.env["POLYGON_API_KEY"] ?? "").replace(/\s+/g, "");
        if (!key) return Response.json({ key: false });
        const out: Record<string, unknown> = { key: true, len: key.length };
        const day = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
        for (const [name, path] of [
          ["groupedStocks", `/v2/aggs/grouped/locale/us/market/stocks/${day}?adjusted=true`],
          ["groupedCrypto", `/v2/aggs/grouped/locale/global/market/crypto/${day}?adjusted=true`],
          ["groupedFx", `/v2/aggs/grouped/locale/global/market/fx/${day}?adjusted=true`],
          ["news", `/v2/reference/news?limit=3`],
          ["aaplAgg", `/v2/aggs/ticker/AAPL/range/5/minute/${day}/${day}?limit=5`],
        ] as const) {
          const res = await fetch(`https://api.polygon.io${path}&apiKey=${key}`);
          const j = (await res.json()) as { status?: string; resultsCount?: number; results?: unknown[] };
          out[name] = {
            http: res.status,
            status: j.status,
            n: j.resultsCount ?? (Array.isArray(j.results) ? j.results.length : 0),
          };
          await new Promise((r) => setTimeout(r, 1200));
        }
        return Response.json(out);
      },
    },
  },
});
