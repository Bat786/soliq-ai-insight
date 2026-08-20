import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getStablecoinBalances, getStablecoinDesk } from "@/lib/stablecoins.functions";

export function useStablecoinDesk() {
  const fn = useServerFn(getStablecoinDesk);
  return useQuery({
    queryKey: ["stablecoins", "desk"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useStablecoinBalances(owner: string | null | undefined) {
  const fn = useServerFn(getStablecoinBalances);
  return useQuery({
    queryKey: ["stablecoins", "balances", owner ?? ""],
    queryFn: () => fn({ data: { owner: owner ?? "" } }),
    enabled: Boolean(owner),
    staleTime: 30_000,
    retry: false,
  });
}
