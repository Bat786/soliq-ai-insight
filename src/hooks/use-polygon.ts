import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { Timeframe } from "@/lib/futures.server";
import { getMarketBoard, getMarketDetail } from "@/lib/polygon.functions";

export function useMarketBoard() {
  const fn = useServerFn(getMarketBoard);
  return useQuery({
    queryKey: ["polygon", "board"],
    queryFn: () => fn(),
    refetchInterval: 45_000,
    staleTime: 20_000,
  });
}

export function useMarketDetail(key: string, interval: Timeframe) {
  const fn = useServerFn(getMarketDetail);
  return useQuery({
    queryKey: ["polygon", "detail", key, interval],
    queryFn: () => fn({ data: { key, interval } }),
    enabled: key.trim().length > 0,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
}
