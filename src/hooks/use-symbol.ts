import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getSymbolDashboard, searchAllSymbols } from "@/lib/symbol.functions";
import type { DeskTf, SymbolMarket } from "@/lib/timeframes";

export function useSymbolDashboard(market: SymbolMarket, symbol: string, timeframe: DeskTf) {
  const fn = useServerFn(getSymbolDashboard);
  return useQuery({
    queryKey: ["symbol", market, symbol.toUpperCase(), timeframe],
    queryFn: () => fn({ data: { market, symbol, timeframe } }),
    enabled: symbol.trim().length > 0,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });
}

export function useSymbolSearch(q: string) {
  const fn = useServerFn(searchAllSymbols);
  return useQuery({
    queryKey: ["symbol", "search", q],
    queryFn: () => fn({ data: { q } }),
    enabled: q.trim().length > 0,
    staleTime: 60_000,
    retry: false,
  });
}
