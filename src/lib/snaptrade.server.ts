/**
 * SnapTrade brokerage connectivity — server only.
 *
 * Built on the official `snaptrade-typescript-sdk`, which owns request signing,
 * pagination shapes and response models. The SDK ships an axios client; we pin
 * the `fetch` adapter so it runs unchanged in the edge runtime.
 *
 * Everything here is read-only: register a SOLIQ user, hand back a connection
 * portal URL, then pull accounts, holdings and transactions.
 */

import { Snaptrade, SnaptradeAuth, type Account, type Position, type UniversalActivity } from "snaptrade-typescript-sdk";

let client: Snaptrade<ReturnType<typeof SnaptradeAuth.commercialApiKey>> | null = null;

export function snaptradeConfigured(): boolean {
  return Boolean(process.env["SNAPTRADE_CLIENT_ID"] && process.env["SNAPTRADE_CONSUMER_KEY"]);
}

function sdk() {
  const clientId = process.env["SNAPTRADE_CLIENT_ID"];
  const consumerKey = process.env["SNAPTRADE_CONSUMER_KEY"];
  if (!clientId || !consumerKey) throw new Error("snaptrade:not-configured");
  if (!client) {
    client = new Snaptrade({
      auth: SnaptradeAuth.commercialApiKey({ clientId, consumerKey }),
      // The SDK's default axios adapter expects Node/XHR internals; `fetch` is
      // the only adapter available in the edge runtime.
      baseOptions: { adapter: "fetch", timeout: 20_000 },
    });
  }
  return client;
}

/** Normalise SDK/axios failures into the `snaptrade:<status>` shape callers expect. */
function fail(error: unknown): never {
  const e = error as { response?: { status?: number; data?: unknown }; message?: string };
  const status = e?.response?.status;
  const detail = typeof e?.response?.data === "string" ? e.response.data : JSON.stringify(e?.response?.data ?? {});
  throw new Error(`snaptrade:${status ?? "network"}:${String(detail).slice(0, 240)}`);
}

/* ------------------------------- API status -------------------------------- */

export type SnaptradeApiStatus = { online: boolean; version: number | null; timestamp: string | null };

/** SnapTrade's unauthenticated status endpoint (GET https://api.snaptrade.com/api/v1/). */
export async function snaptradeApiStatus(): Promise<SnaptradeApiStatus> {
  try {
    const res = await fetch("https://api.snaptrade.com/api/v1/", { headers: { Accept: "application/json" } });
    if (!res.ok) return { online: false, version: null, timestamp: null };
    const body = (await res.json()) as { online?: boolean; version?: number; timestamp?: string };
    return {
      online: Boolean(body?.online),
      version: typeof body?.version === "number" ? body.version : null,
      timestamp: body?.timestamp ?? null,
    };
  } catch {
    return { online: false, version: null, timestamp: null };
  }
}

/* ------------------------------- user handles ------------------------------ */

export type SnapUser = { userId: string; userSecret: string };

export async function registerSnapUser(userId: string): Promise<SnapUser> {
  try {
    const { data } = await sdk().authentication.registerSnapTradeUser({ userId });
    if (!data.userId || !data.userSecret) throw new Error("snaptrade:register-incomplete");
    return { userId: data.userId, userSecret: data.userSecret };
  } catch (error) {
    return fail(error);
  }
}

/** Rotate the stored secret when SnapTrade no longer recognises ours. */
export async function resetSnapUserSecret(userId: string): Promise<SnapUser> {
  try {
    const { data } = await sdk().authentication.resetSnapTradeUserSecret({ userId, userSecret: "" });
    if (!data.userId || !data.userSecret) throw new Error("snaptrade:reset-incomplete");
    return { userId: data.userId, userSecret: data.userSecret };
  } catch (error) {
    return fail(error);
  }
}

export type PortalOptions = {
  /** "read" (default) or "trade" — SnapTrade connection scope. */
  connectionType?: "read" | "trade";
  /** Authorization (connection) UUID to repair instead of creating a new one. */
  reconnect?: string;
  /**
   * Full-page redirect target. Only set this for the pop-out/redirect flow —
   * when the portal is embedded in an iframe, a customRedirect makes SnapTrade
   * navigate the frame away instead of emitting the postMessage events the
   * embedded SDK listens for, which renders as a blank iframe.
   */
  redirectTo?: string;
  /** True when the URL will be loaded inside the embedded connection portal. */
  embedded?: boolean;
};

/** Portal URL the member opens to link a brokerage (read-only by default). */
export async function connectionPortalUrl(user: SnapUser, opts: PortalOptions = {}): Promise<string> {
  const embedded = opts.embedded ?? !opts.redirectTo;
  try {
    const { data } = await sdk().authentication.loginSnapTradeUser({
      userId: user.userId,
      userSecret: user.userSecret,
      connectionType: opts.connectionType ?? "read",
      // v4 is the iframe-embeddable Connection Portal; earlier versions do not
      // post SUCCESS/ERROR/CLOSED events to the parent frame.
      connectionPortalVersion: "v4",
      ...(opts.reconnect ? { reconnect: opts.reconnect } : {}),
      ...(!embedded && opts.redirectTo ? { customRedirect: opts.redirectTo, immediateRedirect: true } : {}),
    });
    const url = (data as { redirectURI?: string })?.redirectURI;
    if (!url) throw new Error("snaptrade:no-portal-url");
    return url;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("snaptrade:")) throw error;
    return fail(error);
  }
}

/* ------------------------------- connections ------------------------------- */

export type BrokerConnection = {
  id: string;
  brokerage: string | null;
  disabled: boolean;
  disabledDate: number | null;
  type: string | null;
  createdAt: number | null;
};

type RawAuthorization = {
  id?: string;
  brokerage?: { name?: string | null; display_name?: string | null } | null;
  disabled?: boolean | null;
  disabled_date?: string | null;
  type?: string | null;
  created_date?: string | null;
};

const mapConnection = (r: RawAuthorization): BrokerConnection => ({
  id: String(r.id ?? ""),
  brokerage: r.brokerage?.display_name ?? r.brokerage?.name ?? null,
  disabled: Boolean(r.disabled),
  disabledDate: r.disabled_date ? Date.parse(r.disabled_date) || null : null,
  type: r.type ?? null,
  createdAt: r.created_date ? Date.parse(r.created_date) || null : null,
});

/** Brokerage authorizations (connections) the member holds. */
export async function listConnections(user: SnapUser): Promise<BrokerConnection[]> {
  try {
    const { data } = await sdk().connections.listBrokerageAuthorizations({
      userId: user.userId,
      userSecret: user.userSecret,
    });
    return (data ?? []).map((r) => mapConnection(r as RawAuthorization)).filter((c) => c.id);
  } catch (error) {
    return fail(error);
  }
}

/** Single authorization detail — used right after a SUCCESS portal message. */
export async function getConnection(user: SnapUser, authorizationId: string): Promise<BrokerConnection | null> {
  try {
    const { data } = await sdk().connections.detailBrokerageAuthorization({
      authorizationId,
      userId: user.userId,
      userSecret: user.userSecret,
    });
    const mapped = mapConnection(data as RawAuthorization);
    return mapped.id ? mapped : null;
  } catch {
    return null;
  }
}

/**
 * Ask the brokerage for fresh holdings now instead of waiting for the daily
 * sync. Manual refresh is a paid SnapTrade capability — on plans without it the
 * API answers 4xx, which we surface as `false` rather than an error.
 */
export async function refreshConnection(user: SnapUser, authorizationId: string): Promise<boolean> {
  try {
    await sdk().connections.refreshBrokerageAuthorization({
      authorizationId,
      userId: user.userId,
      userSecret: user.userSecret,
    });
    return true;
  } catch {
    return false;
  }
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
  authorizationId: string | null;
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

function mapAccount(a: Account): BrokerAccount {
  const raw = a as Account & {
    institution_name?: string | null;
    meta?: { type?: string | null; brokerage_name?: string | null } | null;
    raw_type?: string | null;
    sync_status?: { holdings?: { last_successful_sync?: string | null } | null } | null;
  };
  return {
    id: a.id,
    name: a.name ?? null,
    institution: raw.institution_name ?? raw.meta?.brokerage_name ?? null,
    accountType: raw.meta?.type ?? raw.raw_type ?? null,
    currency: a.balance?.total?.currency ?? "USD",
    totalValue: num(a.balance?.total?.amount),
    cash: null,
    buyingPower: null,
    syncedAt: ms(raw.sync_status?.holdings?.last_successful_sync),
    authorizationId: a.brokerage_authorization ?? null,
  };
}

export async function listAccounts(user: SnapUser): Promise<BrokerAccount[]> {
  try {
    const { data } = await sdk().accountInformation.listUserAccounts({
      userId: user.userId,
      userSecret: user.userSecret,
    });
    return (data ?? []).map(mapAccount);
  } catch (error) {
    return fail(error);
  }
}

function mapPosition(accountId: string, p: Position): BrokerPosition {
  const sym = (p.symbol as { symbol?: { symbol?: string; description?: string | null; currency?: { code?: string } | null } } | undefined)
    ?.symbol;
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
  };
}

export async function accountHoldings(
  user: SnapUser,
  accountId: string,
): Promise<{ positions: BrokerPosition[]; cash: number | null; buyingPower: number | null; totalValue: number | null }> {
  try {
    const { data } = await sdk().accountInformation.getUserHoldings({
      accountId,
      userId: user.userId,
      userSecret: user.userSecret,
    });
    const positions = (data.positions ?? []).map((p) => mapPosition(accountId, p));
    // Options legs carry their own market value; include them so the desk total
    // matches the brokerage.
    const optionValue = (data.option_positions ?? []).reduce((sum, o) => {
      const raw = o as { units?: number | null; price?: number | null };
      const qty = num(raw.units) ?? 0;
      const price = num(raw.price) ?? 0;
      return sum + qty * price * 100;
    }, 0);
    const balances = data.balances ?? [];
    const cash = balances.reduce<number | null>((acc, b) => {
      const v = num(b.cash);
      return v === null ? acc : (acc ?? 0) + v;
    }, null);
    const buyingPower = balances.reduce<number | null>((acc, b) => {
      const v = num(b.buying_power);
      return v === null ? acc : (acc ?? 0) + v;
    }, null);
    const declaredTotal = num((data as { total_value?: { value?: number | null } | null }).total_value?.value);
    const computed =
      positions.reduce((s, p) => s + (p.marketValue ?? 0), 0) + optionValue + (cash ?? 0) || null;
    return { positions, cash, buyingPower, totalValue: declaredTotal ?? computed };
  } catch (error) {
    return fail(error);
  }
}

function mapActivity(r: UniversalActivity, index: number): BrokerActivity {
  const raw = r as UniversalActivity & {
    account?: { id?: string } | null;
    symbol?: { symbol?: string } | null;
    option_symbol?: { ticker?: string } | null;
    currency?: { code?: string } | null;
  };
  return {
    id: String(raw["id"] ?? `activity-${index}`),
    accountId: raw.account?.id ?? null,
    symbol: raw.symbol?.symbol ?? raw.option_symbol?.ticker ?? null,
    type: (raw["type"] as string | undefined) ?? null,
    side: (raw["action"] as string | undefined) ?? null,
    quantity: num(raw["units"]),
    price: num(raw["price"]),
    amount: num(raw["amount"]),
    fees: num(raw["fee"]),
    currency: raw.currency?.code ?? "USD",
    executedAt: ms(raw["trade_date"] ?? raw["settlement_date"]),
  };
}

/**
 * Transaction history. The transactions endpoint is per-account and paginated
 * (`{ data, pagination }`), so we walk each account's pages rather than
 * assuming a flat array.
 */
export async function listActivities(user: SnapUser, accountIds: string[], days = 365): Promise<BrokerActivity[]> {
  if (!accountIds.length) return [];
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const LIMIT = 100;
  const MAX_PAGES = 5;

  const perAccount = await Promise.all(
    accountIds.map(async (accountId) => {
      const rows: BrokerActivity[] = [];
      try {
        for (let page = 0; page < MAX_PAGES; page += 1) {
          const { data } = await sdk().accountInformation.getAccountActivities({
            accountId,
            userId: user.userId,
            userSecret: user.userSecret,
            startDate,
            endDate,
            limit: LIMIT,
            offset: page * LIMIT,
          });
          const batch = data.data ?? [];
          rows.push(...batch.map((r, i) => mapActivity(r as UniversalActivity, page * LIMIT + i)));
          const total = data.pagination?.total ?? rows.length;
          if (batch.length < LIMIT || rows.length >= total) break;
        }
      } catch {
        // A single account failing must not blank the whole ledger.
      }
      return rows.map((r) => ({ ...r, accountId: r.accountId ?? accountId }));
    }),
  );

  return perAccount.flat().sort((a, b) => (b.executedAt ?? 0) - (a.executedAt ?? 0));
}
