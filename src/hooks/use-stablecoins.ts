import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getStablecoinBalances, getStablecoinDesk, getStablecoinHistory } from "@/lib/stablecoins.functions";

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

export function useStablecoinHistory(days: number) {
  const fn = useServerFn(getStablecoinHistory);
  return useQuery({
    queryKey: ["stablecoins", "history", days],
    queryFn: () => fn({ data: { days } }),
    staleTime: 30 * 60_000,
    retry: false,
  });
}
