import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  confirmBrokerageConnection,
  createBrokerageLink,
  getBrokerageConnections,
  getBrokerageSnapshot,
  placeBrokerageOrder,
  refreshBrokerageHoldings,
} from "@/lib/brokerage.functions";


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

export function useBrokerageConnections(enabled: boolean) {
  const fn = useServerFn(getBrokerageConnections);
  return useQuery({
    queryKey: ["brokerage", "connections"],
    queryFn: () => fn(),
    enabled,
    staleTime: 60_000,
  });
}

export type BrokerageLinkInput = {
  redirectTo?: string;
  connectionType?: "read" | "trade";
  reconnect?: string;
};

export function useBrokerageLink() {
  const fn = useServerFn(createBrokerageLink);
  return useMutation({
    mutationFn: (input: BrokerageLinkInput = {}) => fn({ data: input }),
  });
}

export function useConfirmBrokerageConnection() {
  const fn = useServerFn(confirmBrokerageConnection);
  return useMutation({
    mutationFn: (authorizationId: string) => fn({ data: { authorizationId } }),
  });
}

export function useRefreshBrokerageHoldings() {
  const fn = useServerFn(refreshBrokerageHoldings);
  return useMutation({ mutationFn: () => fn() });
}

export type BrokerageOrderInput = {
  accountId: string;
  symbol: string;
  action: "BUY" | "SELL";
  quantity: number;
};

/** Elite-only market order. The server re-checks the tier before submitting. */
export function usePlaceBrokerageOrder() {
  const fn = useServerFn(placeBrokerageOrder);
  return useMutation({ mutationFn: (input: BrokerageOrderInput) => fn({ data: input }) });
}
