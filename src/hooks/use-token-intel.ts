import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getTokenIntel } from "@/lib/token-intel.functions";
import type { TokenIntelTf } from "@/lib/token-intel.server";

export function useTokenIntel(mint: string, timeframe: TokenIntelTf) {
  const fn = useServerFn(getTokenIntel);
  return useQuery({
    queryKey: ["token", "intel", mint, timeframe],
    queryFn: () => fn({ data: { mint, timeframe } }),
    enabled: Boolean(mint),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
