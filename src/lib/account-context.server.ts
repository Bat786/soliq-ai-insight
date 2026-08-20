/**
 * Read-only account + billing snapshot handed to SOLIQ AI so it can answer
 * "what plan am I on / why did my payment fail / is my wallet connected"
 * questions. Strictly informational: it never mutates anything, and every read
 * goes through the caller's RLS-scoped client so one member can never see
 * another member's billing.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const safe = async <T>(p: PromiseLike<{ data: T | null }>): Promise<T | null> => {
  try {
    const { data } = await p;
    return data ?? null;
  } catch {
    return null;
  }
};

export async function buildAccountContext(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<string> {
  const [profile, subs, wallets, brokers, banks] = await Promise.all([
    safe(supabase.from("profiles").select("display_name, membership_tier, renews_at, member_since").eq("id", userId).maybeSingle()),
    safe(
      supabase
        .from("subscriptions")
        .select("status, price_id, environment, current_period_end, cancel_at_period_end, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ),
    safe(supabase.from("linked_wallets").select("chain, address, label").limit(10)),
    safe(supabase.from("broker_connections").select("institution, status, disabled_reason, last_synced_at").limit(10)),
    safe(supabase.from("bank_accounts").select("institution_name, account_name, account_subtype").limit(10)),
  ]);

  const lines: string[] = [];
  lines.push(`plan on profile: ${(profile as any)?.membership_tier ?? "free"}`);
  if ((profile as any)?.renews_at) lines.push(`profile renews_at: ${(profile as any).renews_at}`);

  const rows = (subs as any[]) ?? [];
  if (!rows.length) {
    lines.push("stripe subscriptions: none on record (member has never completed checkout)");
  } else {
    for (const r of rows) {
      lines.push(
        `subscription: ${r.price_id} status=${r.status} env=${r.environment} period_end=${r.current_period_end ?? "n/a"} cancel_at_period_end=${r.cancel_at_period_end ? "yes" : "no"}`,
      );
    }
  }

  const w = (wallets as any[]) ?? [];
  lines.push(
    w.length
      ? `linked wallets: ${w.map((x) => `${x.chain}:${String(x.address).slice(0, 6)}…`).join(", ")}`
      : "linked wallets: none",
  );

  const b = (brokers as any[]) ?? [];
  lines.push(
    b.length
      ? `brokerage connections: ${b
          .map((x) => `${x.institution ?? "brokerage"}${x.status !== "active" ? ` (BROKEN: ${x.disabled_reason ?? "needs reconnect"})` : " (healthy)"}`)
          .join(", ")}`
      : "brokerage connections: none (SnapTrade portal not completed)",
  );

  const k = (banks as any[]) ?? [];
  lines.push(
    k.length ? `bank accounts linked: ${k.length} via ${[...new Set(k.map((x) => x.institution_name))].join(", ")}` : "bank accounts: none linked",
  );

  return lines.join("\n");
}

export const ACCOUNT_SYSTEM_RULES = `You also act as SOLIQ's first-line account and billing support.
Use MEMBER ACCOUNT CONTEXT for anything about the member's plan, subscription, payments, wallets, brokerage or bank connections.
Rules for these questions:
- You are read-only. You cannot change plans, cancel, refund, charge a card or edit account data. Never claim you did.
- Route the member to the right surface instead: /pricing to upgrade or start checkout, the "Manage billing" button (Stripe Customer Portal, opens in a new tab) to change card or cancel, /support to open a ticket, /wallets for Solana/EVM wallets, /brokerage for SnapTrade, /portfolio for bank links, /status for feed health.
- status past_due = a charge failed and Stripe is retrying; access stays on, tell them to update the card in the billing portal.
- cancel_at_period_end = yes means access continues until period_end, then drops to Orbit (free).
- A brokerage connection marked BROKEN needs the Reconnect button on /brokerage.
- If the context shows no subscription, say they are on Orbit (free) and point at /pricing. Never guess amounts, invoice numbers or refund outcomes — send those to /support.`;
