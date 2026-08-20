/**
 * Bank (Plaid) desk loader — server only.
 *
 * Keeps every Plaid `access_token` inside the service-role-only
 * `bank_connections` table. Nothing here returns a token to the caller: the
 * browser sees a short-lived link token and normalized balances only.
 */

import { failed, freshness, ok, unavailable, type DataEnvelope } from "@/engines/core/envelope";
import {
  accountBalances,
  createLinkToken,
  exchangePublicToken,
  institution,
  plaidConfigured,
  removeItem,
  type BankAccount,
} from "@/lib/plaid.server";

const PROVIDER = "plaid";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type BankConnectionRow = {
  id: string;
  itemId: string;
  institutionId: string | null;
  institutionName: string | null;
  accessToken: string;
  status: string;
};

async function connections(userId: string): Promise<BankConnectionRow[]> {
  const admin = await db();
  const { data, error } = await admin
    .from("bank_connections")
    .select("id, item_id, institution_id, institution_name, access_token, status")
    .eq("user_id", userId)
    .eq("provider", PROVIDER)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`bank:database:${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    itemId: r.item_id,
    institutionId: r.institution_id,
    institutionName: r.institution_name,
    accessToken: r.access_token,
    status: r.status,
  }));
}

/** Short-lived Plaid Link token for the signed-in member. */
export async function bankLinkToken(userId: string, redirectUri?: string): Promise<string> {
  if (!plaidConfigured()) throw new Error("plaid:not-configured");
  return createLinkToken(`soliq-${userId}`, redirectUri);
}

/**
 * Swap the one-time public token from Plaid Link for an access token and store
 * it server-side, then mirror the account summary for the member to read.
 */
export async function linkBankAccount(
  userId: string,
  publicToken: string,
): Promise<{ institution: string | null; accounts: number }> {
  if (!plaidConfigured()) throw new Error("plaid:not-configured");
  const { accessToken, itemId } = await exchangePublicToken(publicToken);
  const balances = await accountBalances(accessToken);
  const inst = balances.institutionId ? await institution(balances.institutionId) : { id: null, name: null };

  const admin = await db();
  const { data: row, error } = await admin
    .from("bank_connections")
    .upsert(
      {
        user_id: userId,
        provider: PROVIDER,
        item_id: itemId,
        institution_id: inst.id,
        institution_name: inst.name,
        access_token: accessToken,
        status: "active",
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider,item_id" },
    )
    .select("id")
    .maybeSingle();

  if (error || !row?.id) throw new Error(`bank:database:${error?.message ?? "connection was not saved"}`);
  await mirror(userId, row.id, inst.name, balances.accounts);
  return { institution: inst.name, accounts: balances.accounts.length };
}

export type BankSnapshot = {
  institutions: {
    id: string;
    name: string | null;
    status: string;
    accounts: BankAccount[];
  }[];
  totals: { cash: number; credit: number; accounts: number; institutions: number };
  updatedAt: number;
};

/** Live balances across every institution the member has linked. */
export async function loadBankSnapshot(userId: string): Promise<DataEnvelope<BankSnapshot>> {
  if (!plaidConfigured()) {
    return unavailable<BankSnapshot>("Bank connections are not configured on this deployment.");
  }
  try {
    const rows = await connections(userId);
    if (rows.length === 0) {
      return unavailable<BankSnapshot>("No bank linked yet — connect an account to stream balances.");
    }

    const institutions = await Promise.all(
      rows.map(async (c) => {
        try {
          const balances = await accountBalances(c.accessToken);
          await mirror(userId, c.id, c.institutionName, balances.accounts);
          return { id: c.id, name: c.institutionName, status: c.status, accounts: balances.accounts };
        } catch {
          return { id: c.id, name: c.institutionName, status: "reauth", accounts: [] as BankAccount[] };
        }
      }),
    );

    const totals = institutions.reduce(
      (acc, i) => {
        for (const a of i.accounts) {
          const bal = a.current ?? a.available ?? 0;
          if (a.type === "credit" || a.type === "loan") acc.credit += Math.abs(bal);
          else acc.cash += bal;
          acc.accounts += 1;
        }
        acc.institutions += 1;
        return acc;
      },
      { cash: 0, credit: 0, accounts: 0, institutions: 0 },
    );

    return ok(
      { institutions, totals, updatedAt: Date.now() },
      { source: "supabase", sourceLabel: "Plaid · balance sync", policy: freshness.flow },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "bank error";
    if (/not-configured/.test(msg)) {
      return unavailable<BankSnapshot>("Bank connections are not configured on this deployment.");
    }
    return failed<BankSnapshot>(
      /plaid:4\d\d/.test(msg) ? "Plaid rejected the request — reconnect the institution." : "Bank sync failed.",
    );
  }
}

/** Remove one linked institution: detach at Plaid, then drop the stored token. */
export async function unlinkBankConnection(userId: string, connectionId: string): Promise<void> {
  const admin = await db();
  const { data } = await admin
    .from("bank_connections")
    .select("access_token")
    .eq("user_id", userId)
    .eq("id", connectionId)
    .maybeSingle();
  if (!data) return;
  await removeItem(data.access_token).catch(() => undefined);
  await admin.from("bank_connections").delete().eq("user_id", userId).eq("id", connectionId);
}

/** Advisory mirror of balances so the member sees accounts without a Plaid hit. */
async function mirror(
  userId: string,
  connectionId: string,
  institutionName: string | null,
  accounts: BankAccount[],
): Promise<void> {
  if (!accounts.length) return;
  try {
    const admin = await db();
    const { error } = await admin.from("bank_accounts").upsert(
      accounts.map((a) => ({
        user_id: userId,
        connection_id: connectionId,
        provider_account_id: a.id,
        institution_name: institutionName,
        account_name: a.name,
        official_name: a.officialName,
        mask: a.mask,
        account_type: a.type,
        account_subtype: a.subtype,
        currency: a.currency,
        available_balance: a.available,
        current_balance: a.current,
        last_synced_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,provider_account_id" },
    );
    if (error) throw error;
  } catch {
    // Mirroring is advisory — never block the live desk.
  }
}
