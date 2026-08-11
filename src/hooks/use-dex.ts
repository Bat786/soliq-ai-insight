import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getCryptoDesk, searchDexPairs } from "@/lib/dex.functions";

export function useCryptoDesk() {
  const fn = useServerFn(getCryptoDesk);
  return useQuery({
    queryKey: ["dex", "desk"],
    queryFn: () => fn(),
    refetchInterval: 45_000,
    staleTime: 20_000,
  });
}

export function useDexSearch(q: string) {
  const fn = useServerFn(searchDexPairs);
  return useQuery({
    queryKey: ["dex", "search", q],
    queryFn: () => fn({ data: { q } }),
    enabled: q.trim().length >= 2,
    staleTime: 20_000,
    retry: false,
  });
}
