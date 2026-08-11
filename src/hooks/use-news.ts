import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMarketNews } from "@/lib/news.functions";

/** Live Massive news wire, optionally scoped to one ticker. */
export function useMarketNews(ticker?: string, limit = 12) {
  const fn = useServerFn(getMarketNews);
  return useQuery({
    queryKey: ["news", ticker ?? "all", limit],
    queryFn: () => fn({ data: { ticker, limit } }),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  });
}
