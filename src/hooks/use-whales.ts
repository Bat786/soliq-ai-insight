import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getWhaleFeed } from "@/lib/unusual-whales.functions";

export function useWhaleFeed() {
  const fn = useServerFn(getWhaleFeed);
  return useQuery({
    queryKey: ["whales", "feed"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
