import { createServerFn } from "@tanstack/react-start";

export const getEquityResearch = createServerFn({ method: "GET" })
  .inputValidator((input: { ticker: string }) => ({ ticker: String(input?.ticker ?? "").slice(0, 12).toUpperCase() }))
  .handler(async ({ data }) => {
    const { loadEquityResearch } = await import("@/lib/equity.server");
    return loadEquityResearch(data.ticker);
  });

export const getEquityUniverse = createServerFn({ method: "GET" })
  .inputValidator((input?: { search?: string }) => ({ search: String(input?.search ?? "").slice(0, 40) }))
  .handler(async ({ data }) => {
    const { loadUniverse } = await import("@/lib/equity.server");
    return loadUniverse(data.search || undefined, 200);
  });
