import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getMyBilling, createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import {
  subscriptionGrantsAccess,
  tierFromSubscriptions,
  cadenceFromPriceId,
  type SubscriptionRow,
} from "@/lib/entitlements";
import { useSession } from "@/hooks/use-soliq-account";
import type { Tier } from "@/lib/membership";

export type BillingRow = SubscriptionRow & {
  id: string;
  product_id: string;
  current_period_start: string | null;
  created_at: string;
};

/**
 * Billing state for the signed-in member. Entitlement is derived from the
 * subscription rows the payment webhook writes — never from client state.
 */
export function useBilling() {
  const { session, isSignedIn } = useSession();
  const fetchBilling = useServerFn(getMyBilling);
  const queryClient = useQueryClient();
  const configured = paymentsConfigured();

  const query = useQuery({
    queryKey: ["billing"],
    queryFn: () => fetchBilling({ data: { environment: getStripeEnvironment() } }),
    enabled: isSignedIn && configured,
  });

  // Membership unlocks the moment the webhook lands.
  useEffect(() => {
    if (!session?.userId) return;
    const channel = supabase
      .channel(`subscriptions:${session.userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${session.userId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["billing"] });
          void queryClient.invalidateQueries({ queryKey: ["profile"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.userId, queryClient]);

  const rows = (query.data ?? []) as BillingRow[];
  const active = rows.find(subscriptionGrantsAccess) ?? null;
  const tier = tierFromSubscriptions(rows) as Tier;

  return {
    ...query,
    rows,
    active,
    tier,
    configured,
    cadence: active ? cadenceFromPriceId(active.price_id) : null,
    renewsAt: active?.current_period_end ?? null,
    cancelAtPeriodEnd: active?.cancel_at_period_end ?? false,
    /** Stripe is retrying a failed charge — keep access, prompt for a new card. */
    pastDue: active?.status === "past_due",
    hasBillingAccount: rows.length > 0,
  };
}

/** Opens the hosted billing portal in a new tab (it cannot be iframed). */
export function useBillingPortal() {
  const openPortal = useServerFn(createPortalSession);
  return useMutation({
    mutationFn: async () => {
      const result = await openPortal({
        data: {
          returnUrl: `${window.location.origin}/pricing`,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in result) throw new Error(result.error);
      return result.url;
    },
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener");
    },
    onError: (e: Error) =>
      toast.error("Could not open billing", { description: e.message || "Please try again." }),
  });
}
