/**
 * SnapTrade brokerage connectivity — server only.
 *
 * SnapTrade signs every request: an HMAC-SHA256 over
 * `{ content, path, query }` (alphabetical keys) keyed by the consumer key,
 * sent in the `Signature` header, with `clientId` + `timestamp` on the query
 * string. Everything here is read-only: we register a SOLIQ user, hand back a
 * connection portal URL, then pull accounts, holdings and activities.
 */

import { createHmac } from "node:crypto";

const BASE = "https://api.snaptrade.com/api/v1";

type Creds = { clientId: string; consumerKey: string };

function creds(): Creds {
  const clientId = process.env["SNAPTRADE_CLIENT_ID"];
  const consumerKey = process.env["SNAPTRADE_CONSUMER_KEY"];
  if (!clientId || !consumerKey) throw new Error("snaptrade:not-configured");
  return { clientId, consumerKey };
}

export function snaptradeConfigured(): boolean {
  return Boolean(process.env["SNAPTRADE_CLIENT_ID"] && process.env["SNAPTRADE_CONSUMER_KEY"]);
}

function sign(path: string, query: string, body: unknown | null, consumerKey: string): string {
  const payload = JSON.stringify({ content: body ?? null, path, query });
  return createHmac("sha256", consumerKey).update(payload).digest("base64").replace(/\+/g, "-").replace(/\//g, "_");
}

async function call<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  opts: { params?: Record<string, string>; body?: unknown } = {},
): Promise<T> {
  const { clientId, consumerKey } = creds();
  const path = `/api/v1${endpoint}`;
  const params = new URLSearchParams({
    ...(opts.params ?? {}),
    clientId,
    timestamp: String(Math.floor(Date.now() / 1000)),
  });
  const query = params.toString();
  const signature = sign(path, query, opts.body ?? null, consumerKey);

  const res = await fetch(`${BASE}${endpoint}?${query}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Signature: signature,
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`snaptrade:${res.status}:${detail.slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

/* ------------------------------- user handles ------------------------------ */

export type SnapUser = { userId: string; userSecret: string };

export async function registerSnapUser(userId: string): Promise<SnapUser> {
  const out = await call<{ userId: string; userSecret: string }>("POST", "/snapTrade/registerUser", {
    body: { userId },
  });
  return { userId: out.userId, userSecret: out.userSecret };
}

/** Portal URL the member opens to link a brokerage (read-only by default). */
export async function connectionPortalUrl(user: SnapUser, redirectTo?: string): Promise<string> {
  const out = await call<{ redirectURI?: string }>("POST", "/snapTrade/login", {
    params: { userId: user.userId, userSecret: user.userSecret },
    body: {
      connectionType: "read",
      ...(redirectTo ? { customRedirect: redirectTo } : {}),
    },
  });
  if (!out.redirectURI) throw new Error("snaptrade:no-portal-url");
  return out.redirectURI;
}

/* --------------------------------- reading -------------------------------- */

export type BrokerAccount = {
  id: string;
  name: string | null;
  institution: string | null;
  accountType: string | null;
  currency: string;
  totalValue: number | null;
  cash: number | null;
  buyingPower: number | null;
  syncedAt: number | null;
};

export type BrokerPosition = {
  accountId: string;
  symbol: string;
  description: string | null;
  quantity: number;
  avgCost: number | null;
  price: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPct: number | null;
  currency: string;
};

export type BrokerActivity = {
  id: string;
  accountId: string | null;
  symbol: string | null;
  type: string | null;
  side: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  fees: number | null;
  currency: string;
  executedAt: number | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const ms = (v: unknown): number | null => {
  const t = Date.parse(String(v ?? ""));
  return Number.isFinite(t) ? t : null;
};

type RawAccount = {
  id: string;
  name?: string | null;
  institution_name?: string | null;
  meta?: { type?: string | null; brokerage_name?: string | null } | null;
  balance?: { total?: { amount?: number | null; currency?: string | null } | null } | null;
  cash_restrictions?: unknown;
  sync_status?: { holdings?: { last_successful_sync?: string | null } | null } | null;
  raw_type?: string | null;
};

export async function listAccounts(user: SnapUser): Promise<BrokerAccount[]> {
  const rows = await call<RawAccount[]>("GET", "/accounts", {
    params: { userId: user.userId, userSecret: user.userSecret },
  });
  return (rows ?? []).map((a) => ({
    id: a.id,
    name: a.name ?? null,
    institution: a.institution_name ?? a.meta?.brokerage_name ?? null,
    accountType: a.meta?.type ?? a.raw_type ?? null,
    currency: a.balance?.total?.currency ?? "USD",
    totalValue: num(a.balance?.total?.amount),
    cash: null,
    buyingPower: null,
    syncedAt: ms(a.sync_status?.holdings?.last_successful_sync),
  }));
}

type RawHoldings = {
  account?: { id?: string } | null;
  balances?: { cash?: number | null; buying_power?: number | null; currency?: { code?: string } | null }[] | null;
  positions?: {
    symbol?: { symbol?: { symbol?: string; description?: string | null; currency?: { code?: string } | null } | null } | null;
    units?: number | null;
    price?: number | null;
    average_purchase_price?: number | null;
    open_pnl?: number | null;
  }[] | null;
  total_value?: { value?: number | null; currency?: string | null } | null;
};

export async function accountHoldings(
  user: SnapUser,
  accountId: string,
): Promise<{ positions: BrokerPosition[]; cash: number | null; buyingPower: number | null; totalValue: number | null }> {
  const h = await call<RawHoldings>("GET", `/accounts/${accountId}/holdings`, {
    params: { userId: user.userId, userSecret: user.userSecret },
  });
  const positions = (h.positions ?? []).map((p) => {
    const sym = p.symbol?.symbol;
    const qty = num(p.units) ?? 0;
    const price = num(p.price);
    const avg = num(p.average_purchase_price);
    const marketValue = price !== null ? qty * price : null;
    const pnl = num(p.open_pnl) ?? (price !== null && avg !== null ? (price - avg) * qty : null);
    const basis = avg !== null ? avg * qty : null;
    return {
      accountId,
      symbol: sym?.symbol ?? "—",
      description: sym?.description ?? null,
      quantity: qty,
      avgCost: avg,
      price,
      marketValue,
      unrealizedPnl: pnl,
      unrealizedPct: pnl !== null && basis ? (pnl / Math.abs(basis)) * 100 : null,
      currency: sym?.currency?.code ?? "USD",
    } satisfies BrokerPosition;
  });
  const bal = h.balances?.[0];
  return {
    positions,
    cash: num(bal?.cash),
    buyingPower: num(bal?.buying_power),
    totalValue: num(h.total_value?.value),
  };
}

type RawActivity = {
  id?: string;
  account?: { id?: string } | null;
  symbol?: { symbol?: string } | null;
  option_symbol?: { ticker?: string } | null;
  type?: string | null;
  action?: string | null;
  units?: number | null;
  price?: number | null;
  amount?: number | null;
  fee?: number | null;
  currency?: { code?: string } | null;
  trade_date?: string | null;
  settlement_date?: string | null;
};

export async function listActivities(user: SnapUser, days = 365): Promise<BrokerActivity[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const rows = await call<RawActivity[]>("GET", "/activities", {
    params: {
      userId: user.userId,
      userSecret: user.userSecret,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    },
  });
  return (rows ?? [])
    .map((r, i) => ({
      id: r.id ?? `activity-${i}`,
      accountId: r.account?.id ?? null,
      symbol: r.symbol?.symbol ?? r.option_symbol?.ticker ?? null,
      type: r.type ?? null,
      side: r.action ?? null,
      quantity: num(r.units),
      price: num(r.price),
      amount: num(r.amount),
      fees: num(r.fee),
      currency: r.currency?.code ?? "USD",
      executedAt: ms(r.trade_date ?? r.settlement_date),
    }))
    .sort((a, b) => (b.executedAt ?? 0) - (a.executedAt ?? 0));
}
