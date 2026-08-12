import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getEquityResearch, getEquityUniverse } from "@/lib/equity.functions";

export function useEquityResearch(ticker: string) {
  const fn = useServerFn(getEquityResearch);
  return useQuery({
    queryKey: ["equity", "research", ticker],
    queryFn: () => fn({ data: { ticker } }),
    enabled: ticker.trim().length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useEquityUniverse(search: string) {
  const fn = useServerFn(getEquityUniverse);
  return useQuery({
    queryKey: ["equity", "universe", search],
    queryFn: () => fn({ data: { search } }),
    staleTime: 10 * 60_000,
    retry: false,
  });
}
