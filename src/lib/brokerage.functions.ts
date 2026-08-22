import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { meetsTier } from "@/lib/entitlements";
import type { Tier } from "@/lib/membership";

/**
 * Brokerage intelligence is a paid surface:
 *   Orbit (free) — locked, no connection and no sync
 *   Pro         — read-only sync: holdings, P&L, transactions, analytics
 *   Elite       — everything in Pro plus SnapTrade trading (BUY / SELL)
 *
 * Tier is always re-read from the database inside the handler; the client is
 * never trusted for entitlements.
 */
async function memberTier(supabase: { from: (t: string) => any }, userId: string): Promise<Tier> {
  const { data } = await supabase.from("profiles").select("membership_tier").eq("id", userId).maybeSingle();
  return ((data?.membership_tier as Tier | undefined) ?? "free") as Tier;
}

const LOCKED = "Brokerage intelligence is part of Pro and Elite. Upgrade to connect a brokerage.";
const TRADE_LOCKED = "Trading through SnapTrade is an Elite capability. Pro accounts are view-only.";

/** Mint a SnapTrade Connection Portal login link for the signed-in member. */
export const createBrokerageLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { redirectTo?: string; connectionType?: "read" | "trade"; reconnect?: string; embedded?: boolean }) => ({
    redirectTo: input?.redirectTo ?? undefined,
    connectionType: input?.connectionType === "trade" ? ("trade" as const) : ("read" as const),
    reconnect: input?.reconnect ?? undefined,
    // Default to the embedded portal: the app opens the URL inside the
    // SnapTrade React modal, which needs postMessage events (no customRedirect).
    embedded: input?.embedded !== false,
  }))
  .handler(async ({ data, context }) => {
    const tier = await memberTier(context.supabase, context.userId);
    if (!meetsTier(tier, "pro")) return { url: null as string | null, error: LOCKED };
    // Trade authorisation is only requested for Elite; Pro links read-only.
    const connectionType = tier === "elite" ? data.connectionType : ("read" as const);

    const { brokerageConnectUrl } = await import("@/lib/brokerage.server");
    try {
      const url = await brokerageConnectUrl(context.userId, {
        connectionType,
        embedded: data.embedded,
        ...(data.reconnect ? { reconnect: data.reconnect } : {}),
        ...(!data.embedded && data.redirectTo ? { redirectTo: data.redirectTo } : {}),
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
    const tier = await memberTier(context.supabase, context.userId);
    if (!meetsTier(tier, "pro")) {
      const { unavailable } = await import("@/engines/core/envelope");
      return unavailable<never>(LOCKED, "snaptrade");
    }
    const { loadBrokerageSnapshot } = await import("@/lib/brokerage.server");
    return loadBrokerageSnapshot(context.userId);
  });

/** Every brokerage authorization the member holds, including broken ones. */
export const getBrokerageConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tier = await memberTier(context.supabase, context.userId);
    if (!meetsTier(tier, "pro")) return { connections: [] };
    const { loadBrokerageConnections } = await import("@/lib/brokerage.server");
    return { connections: await loadBrokerageConnections(context.userId) };
  });

/** Ask the brokerage for fresh holdings now (paid SnapTrade capability). */
export const refreshBrokerageHoldings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tier = await memberTier(context.supabase, context.userId);
    if (!meetsTier(tier, "pro")) return { requested: 0, accepted: 0 };
    const { refreshBrokerageHoldings: refresh } = await import("@/lib/brokerage.server");
    return refresh(context.userId);
  });

/** Portal SUCCESS callback — persist the freshly created/repaired connection. */
export const confirmBrokerageConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { authorizationId: string }) => ({
    authorizationId: String(input?.authorizationId ?? "").slice(0, 64),
  }))
  .handler(async ({ data, context }) => {
    const tier = await memberTier(context.supabase, context.userId);
    if (!meetsTier(tier, "pro")) return { connection: null };
    const { recordBrokerageConnection } = await import("@/lib/brokerage.server");
    const connection = data.authorizationId
      ? await recordBrokerageConnection(context.userId, data.authorizationId)
      : null;
    return { connection };
  });

/** Elite-only market order through the member's own SnapTrade connection. */
export const placeBrokerageOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; symbol: string; action: "BUY" | "SELL"; quantity: number }) => ({
    accountId: String(input?.accountId ?? "").slice(0, 64),
    symbol: String(input?.symbol ?? "").toUpperCase().slice(0, 24),
    action: input?.action === "SELL" ? ("SELL" as const) : ("BUY" as const),
    quantity: Math.max(0, Number(input?.quantity ?? 0)),
  }))
  .handler(async ({ data, context }) => {
    const tier = await memberTier(context.supabase, context.userId);
    if (!meetsTier(tier, "elite")) {
      return { ok: false, orderId: null, status: null, error: TRADE_LOCKED };
    }
    if (!data.accountId || !data.symbol || !data.quantity) {
      return { ok: false, orderId: null, status: null, error: "Enter a symbol and a quantity greater than zero." };
    }
    const { placeBrokerageOrder: place } = await import("@/lib/brokerage.server");
    return place(context.userId, data);
  });
