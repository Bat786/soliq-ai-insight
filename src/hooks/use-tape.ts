import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { DeskId } from "@/lib/tape.server";
import type { Timeframe } from "@/lib/futures.server";
import { getTapeBoard, getTapeDetail, searchTape } from "@/lib/tape.functions";

export function useTapeBoard(desk?: DeskId) {
  const fn = useServerFn(getTapeBoard);
  return useQuery({
    queryKey: ["tape", "board", desk ?? "all"],
    queryFn: () => fn({ data: { desk } }),
    refetchInterval: 45_000,
    staleTime: 20_000,
  });
}

export function useTapeDetail(key: string, interval: Timeframe) {
  const fn = useServerFn(getTapeDetail);
  return useQuery({
    queryKey: ["tape", "detail", key, interval],
    queryFn: () => fn({ data: { key, interval } }),
    enabled: key.trim().length > 0,
    refetchInterval: 60_000,
    staleTime: 25_000,
    retry: false,
  });
}

export function useTapeSearch(q: string) {
  const fn = useServerFn(searchTape);
  return useQuery({
    queryKey: ["tape", "search", q],
    queryFn: () => fn({ data: { q } }),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
    retry: false,
  });
}
