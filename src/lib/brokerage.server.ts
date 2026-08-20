/**
 * Brokerage desk loader — server only.
 *
 * Bridges SnapTrade to SOLIQ: keeps the per-member SnapTrade handle in a
 * service-role-only table, mints connection portal links, and reads accounts,
 * holdings and trade history into one envelope-friendly snapshot.
 */

import { failed, ok, unavailable, freshness, type DataEnvelope } from "@/engines/core/envelope";
import {
  accountHoldings,
  connectionPortalUrl,
  getConnection,
  listAccounts,
  listConnections,
  listActivities,
  refreshConnection,
  registerSnapUser,
  snaptradeConfigured,
  type BrokerAccount,
  type BrokerConnection,
  type PortalOptions,
  type BrokerActivity,
  type BrokerPosition,
  type SnapUser,
} from "@/lib/snaptrade.server";

const PROVIDER = "snaptrade";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Look up (or register) the SnapTrade handle for a SOLIQ member. */
async function snapUser(userId: string): Promise<SnapUser> {
  const admin = await db();
  const { data } = await admin
    .from("broker_provider_secrets")
    .select("provider_user_id, provider_user_secret")
    .eq("user_id", userId)
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (data?.provider_user_id && data.provider_user_secret) {
    return { userId: data.provider_user_id, userSecret: data.provider_user_secret };
  }

  const registered = await registerSnapUser(`soliq-${userId}`);
  const { error } = await admin.from("broker_provider_secrets").upsert(
    {
      user_id: userId,
      provider: PROVIDER,
      provider_user_id: registered.userId,
      provider_user_secret: registered.userSecret,
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error(`brokerage:database:${error.message}`);
  return registered;
}

/** URL of the SnapTrade portal where the member picks (or repairs) their brokerage. */
export async function brokerageConnectUrl(userId: string, opts: PortalOptions = {}): Promise<string> {
  if (!snaptradeConfigured()) throw new Error("Brokerage connections are not configured on this deployment.");
  const user = await snapUser(userId);
  return connectionPortalUrl(user, opts);
}

/** Connections (authorizations) the member holds, including broken ones. */
export async function loadBrokerageConnections(userId: string): Promise<BrokerConnection[]> {
  if (!snaptradeConfigured()) return [];
  try {
    const user = await snapUser(userId);
    const connections = await listConnections(user);
    await syncConnectionRows(userId, connections);
    return connections;
  } catch {
    return [];
  }
}

/** After a portal SUCCESS message: record the new authorization server-side. */
export async function recordBrokerageConnection(
  userId: string,
  authorizationId: string,
): Promise<BrokerConnection | null> {
  if (!snaptradeConfigured()) return null;
  try {
    const user = await snapUser(userId);
    const detail = (await getConnection(user, authorizationId)) ?? null;
    const connections = detail ? [detail] : await listConnections(user);
    await syncConnectionRows(userId, connections);
    return detail ?? connections.find((c) => c.id === authorizationId) ?? null;
  } catch {
    return null;
  }
}

/** Mirror authorization status into broker_connections (best effort). */
async function syncConnectionRows(userId: string, connections: BrokerConnection[]): Promise<void> {
  if (!connections.length) return;
  try {
    const admin = await db();
    for (const c of connections) {
      const { data: existing } = await admin
        .from("broker_connections")
        .select("id")
        .eq("user_id", userId)
        .eq("provider", PROVIDER)
        .eq("connection_id", c.id)
        .maybeSingle();
      const row = {
        user_id: userId,
        provider: PROVIDER,
        connection_id: c.id,
        institution: c.brokerage,
        status: c.disabled ? "broken" : "active",
        disabled_reason: c.disabled ? "Connection disabled by the brokerage — reconnect required." : null,
        last_synced_at: new Date().toISOString(),
      };
      const result = existing?.id
        ? await admin.from("broker_connections").update(row).eq("id", existing.id)
        : await admin.from("broker_connections").insert(row);
      if (result.error) throw result.error;
    }
  } catch {
    // advisory only
  }
}


/**
 * Ask each live connection for fresh holdings. Manual refresh is a paid
 * SnapTrade capability; when the plan does not include it every call reports
 * `false` and we tell the member the daily sync still applies.
 */
export async function refreshBrokerageHoldings(userId: string): Promise<{ requested: number; accepted: number }> {
  if (!snaptradeConfigured()) return { requested: 0, accepted: 0 };
  try {
    const user = await snapUser(userId);
    const connections = (await listConnections(user)).filter((c) => !c.disabled);
    const results = await Promise.all(connections.map((c) => refreshConnection(user, c.id)));
    return { requested: connections.length, accepted: results.filter(Boolean).length };
  } catch {
    return { requested: 0, accepted: 0 };
  }
}

export type BrokerageSnapshot = {
  accounts: (BrokerAccount & { positions: BrokerPosition[] })[];
  activities: BrokerActivity[];
  totals: {
    marketValue: number;
    cash: number;
    unrealizedPnl: number;
    positions: number;
    accounts: number;
  };
  updatedAt: number;
};

/** Full read-only brokerage snapshot for one member. */
export async function loadBrokerageSnapshot(userId: string): Promise<DataEnvelope<BrokerageSnapshot>> {
  if (!snaptradeConfigured()) {
    return unavailable<BrokerageSnapshot>("Brokerage connections are not configured on this deployment.");
  }
  try {
    const user = await snapUser(userId);
    const accounts = await listAccounts(user);
    if (accounts.length === 0) {
      return unavailable<BrokerageSnapshot>("No brokerage connected yet — link an account to stream live positions.");
    }

    const withHoldings = await Promise.all(
      accounts.map(async (a) => {
        try {
          const h = await accountHoldings(user, a.id);
          return {
            ...a,
            cash: h.cash ?? a.cash,
            totalValue: h.totalValue ?? a.totalValue,
            buyingPower: h.buyingPower ?? a.buyingPower,
            positions: h.positions,
          };
        } catch {
          return { ...a, positions: [] as BrokerPosition[] };
        }
      }),
    );

    const activities = await listActivities(
      user,
      accounts.map((a) => a.id),
    ).catch(() => [] as BrokerActivity[]);

    const totals = withHoldings.reduce(
      (acc, a) => {
        for (const p of a.positions) {
          acc.marketValue += p.marketValue ?? 0;
          acc.unrealizedPnl += p.unrealizedPnl ?? 0;
          acc.positions += 1;
        }
        acc.cash += a.cash ?? 0;
        acc.accounts += 1;
        return acc;
      },
      { marketValue: 0, cash: 0, unrealizedPnl: 0, positions: 0, accounts: 0 },
    );

    await persist(userId, withHoldings, activities);

    return ok(
      { accounts: withHoldings, activities, totals, updatedAt: Date.now() },
      { source: "supabase", sourceLabel: "SnapTrade · brokerage sync", policy: freshness.flow },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "brokerage error";
    if (/not-configured/.test(msg)) {
      return unavailable<BrokerageSnapshot>("Brokerage connections are not configured on this deployment.");
    }
    return failed<BrokerageSnapshot>(
      /snaptrade:4\d\d/.test(msg) ? "SnapTrade rejected the request — reconnect the brokerage." : "Brokerage sync failed.",
    );
  }
}

/** Best-effort mirroring into Postgres so history survives provider outages. */
async function persist(
  userId: string,
  accounts: (BrokerAccount & { positions: BrokerPosition[] })[],
  activities: BrokerActivity[],
): Promise<void> {
  try {
    const admin = await db();
    const { data: conn } = await admin
      .from("broker_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", PROVIDER)
      .maybeSingle();

    let connectionId = conn?.id ?? null;
    if (!connectionId) {
      const { data: created } = await admin
        .from("broker_connections")
        .insert({ user_id: userId, provider: PROVIDER, status: "active" })
        .select("id")
        .maybeSingle();
      connectionId = created?.id ?? null;
    }
    if (!connectionId) return;

    for (const a of accounts) {
      const { data: existing } = await admin
        .from("broker_accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("provider_account_id", a.id)
        .maybeSingle();

      const row = {
        user_id: userId,
        connection_id: connectionId,
        provider_account_id: a.id,
        account_name: a.name,
        account_type: a.accountType,
        institution: a.institution,
        currency: a.currency,
        total_value: a.totalValue,
        cash: a.cash,
        buying_power: a.buyingPower,
        read_only: true,
        last_synced_at: new Date().toISOString(),
      };

      const accountId = existing?.id
        ? ((await admin.from("broker_accounts").update(row).eq("id", existing.id)), existing.id)
        : (await admin.from("broker_accounts").insert(row).select("id").maybeSingle()).data?.id;
      if (!accountId) continue;

      if (a.positions.length) {
        const { error } = await admin.from("broker_positions").upsert(
          a.positions.map((p) => ({
            user_id: userId,
            account_id: accountId,
            symbol: p.symbol,
            quantity: p.quantity,
            avg_cost: p.avgCost,
            market_value: p.marketValue,
            unrealized_pnl: p.unrealizedPnl,
            currency: p.currency,
          })),
          { onConflict: "account_id,symbol" },
        );
        if (error) throw error;
      }

      const mine = activities.filter((t) => t.accountId === a.id).slice(0, 200);
      if (mine.length) {
        const { error } = await admin.from("broker_transactions").upsert(
          mine.map((t) => ({
            user_id: userId,
            account_id: accountId,
            provider_transaction_id: t.id,
            symbol: t.symbol,
            transaction_type: t.type,
            side: t.side,
            quantity: t.quantity,
            price: t.price,
            amount: t.amount,
            fees: t.fees,
            currency: t.currency,
            executed_at: t.executedAt ? new Date(t.executedAt).toISOString() : null,
          })),
          { onConflict: "account_id,provider_transaction_id", ignoreDuplicates: true },
        );
        if (error) throw error;
      }
    }
  } catch {
    // Persistence is advisory — never block the live desk.
  }
}
