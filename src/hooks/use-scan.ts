import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getCryptoScan, getMarketScan } from "@/lib/scan.functions";
import type { ScanFiltersInput } from "@/lib/scan.server";

export function useMarketScan(filters: ScanFiltersInput) {
  const fn = useServerFn(getMarketScan);
  return useQuery({
    queryKey: ["scan", "market", filters],
    queryFn: () => fn({ data: filters }),
    refetchInterval: 45_000,
    staleTime: 20_000,
  });
}

export function useCryptoScan() {
  const fn = useServerFn(getCryptoScan);
  return useQuery({
    queryKey: ["scan", "crypto"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
