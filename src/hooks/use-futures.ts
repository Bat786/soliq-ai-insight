import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { Timeframe } from "@/lib/futures.server";
import { getFuturesBoard, getTickerDetail } from "@/lib/futures.functions";

export function useFuturesBoard() {
  const fn = useServerFn(getFuturesBoard);
  return useQuery({
    queryKey: ["futures", "board"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useTickerDetail(symbol: string, interval: Timeframe) {
  const fn = useServerFn(getTickerDetail);
  return useQuery({
    queryKey: ["futures", "ticker", symbol.toUpperCase(), interval],
    queryFn: () => fn({ data: { symbol, interval } }),
    enabled: symbol.trim().length > 0,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });
}
