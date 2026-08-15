import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { createBrokerageLink, getBrokerageSnapshot } from "@/lib/brokerage.functions";

export function useBrokerage(enabled: boolean) {
  const fn = useServerFn(getBrokerageSnapshot);
  return useQuery({
    queryKey: ["brokerage", "snapshot"],
    queryFn: () => fn(),
    enabled,
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}

export function useBrokerageLink() {
  const fn = useServerFn(createBrokerageLink);
  return useMutation({
    mutationFn: (redirectTo?: string) => fn({ data: { ...(redirectTo ? { redirectTo } : {}) } }),
  });
}
