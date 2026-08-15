import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Mint a SnapTrade connection portal URL for the signed-in member. */
export const createBrokerageLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { redirectTo?: string }) => ({ redirectTo: input?.redirectTo ?? undefined }))
  .handler(async ({ data, context }) => {
    const { brokerageConnectUrl } = await import("@/lib/brokerage.server");
    try {
      const url = await brokerageConnectUrl(context.userId, data.redirectTo);
      return { url, error: null as string | null };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      return {
        url: null as string | null,
        error: /not configured/i.test(msg)
          ? "Brokerage linking is not configured on this deployment."
          : "SnapTrade could not start the connection. Try again shortly.",
      };
    }
  });

/** Read-only accounts, positions, P&L and trade history for the member. */
export const getBrokerageSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadBrokerageSnapshot } = await import("@/lib/brokerage.server");
    return loadBrokerageSnapshot(context.userId);
  });
