import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Mint a SnapTrade Connection Portal login link for the signed-in member. */
export const createBrokerageLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { redirectTo?: string; connectionType?: "read" | "trade"; reconnect?: string }) => ({
    redirectTo: input?.redirectTo ?? undefined,
    connectionType: input?.connectionType === "trade" ? ("trade" as const) : ("read" as const),
    reconnect: input?.reconnect ?? undefined,
  }))
  .handler(async ({ data, context }) => {
    const { brokerageConnectUrl } = await import("@/lib/brokerage.server");
    try {
      const url = await brokerageConnectUrl(context.userId, {
        connectionType: data.connectionType,
        ...(data.reconnect ? { reconnect: data.reconnect } : {}),
        ...(data.redirectTo ? { redirectTo: data.redirectTo } : {}),
      });
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

/** Every brokerage authorization the member holds, including broken ones. */
export const getBrokerageConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadBrokerageConnections } = await import("@/lib/brokerage.server");
    return { connections: await loadBrokerageConnections(context.userId) };
  });

/** Portal SUCCESS callback — persist the freshly created/repaired connection. */
export const confirmBrokerageConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { authorizationId: string }) => ({
    authorizationId: String(input?.authorizationId ?? "").slice(0, 64),
  }))
  .handler(async ({ data, context }) => {
    const { recordBrokerageConnection } = await import("@/lib/brokerage.server");
    const connection = data.authorizationId
      ? await recordBrokerageConnection(context.userId, data.authorizationId)
      : null;
    return { connection };
  });
