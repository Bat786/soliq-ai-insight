import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAssetDetail, getMarketSnapshot } from "@/lib/live-market.functions";

export function useMarket() {
  const fn = useServerFn(getMarketSnapshot);
  return useQuery({
    queryKey: ["market", "snapshot"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useAssetDetail(id: string, days = 90) {
  const fn = useServerFn(getAssetDetail);
  return useQuery({
    queryKey: ["market", "asset", id, days],
    queryFn: () => fn({ data: { id, days } }),
    enabled: Boolean(id),
    refetchInterval: 90_000,
  });
}
