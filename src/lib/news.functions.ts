import { createServerFn } from "@tanstack/react-start";

/** Live market news wire from the Massive REST API. */
export const getMarketNews = createServerFn({ method: "GET" })
  .inputValidator((input: { ticker?: string; limit?: number } | undefined) => ({
    ticker: input?.ticker ? String(input.ticker).slice(0, 12) : undefined,
    limit: Math.max(4, Math.min(30, Number(input?.limit ?? 12))),
  }))
  .handler(async ({ data }) => {
    const { massiveNews } = await import("@/lib/massive.server");
    try {
      return await massiveNews(data.ticker, data.limit);
    } catch {
      return [];
    }
  });
