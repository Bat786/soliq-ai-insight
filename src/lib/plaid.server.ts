/**
 * Plaid connectivity — server only.
 *
 * Plain `fetch` against the Plaid REST API (no SDK: the Node SDK is not
 * Worker-friendly). Credentials live in `PLAID_CLIENT_ID` / `PLAID_SECRET`,
 * the host is picked from `PLAID_ENV` (`sandbox` | `production`).
 *
 * Access tokens returned by Plaid are long-lived credentials. They are stored
 * in a service-role-only table and never leave the server: the browser only
 * ever sees a short-lived `link_token` and normalized balances.
 */

type Creds = { clientId: string; secret: string; host: string };

const HOSTS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

function creds(): Creds {
  const clientId = process.env["PLAID_CLIENT_ID"];
  const secret = process.env["PLAID_SECRET"];
  if (!clientId || !secret) throw new Error("plaid:not-configured");
  const env = (process.env["PLAID_ENV"] ?? "").toLowerCase();
  const host = HOSTS[env];
  if (!host) throw new Error("plaid:invalid-environment");
  return { clientId, secret, host };
}

export function plaidConfigured(): boolean {
  const env = (process.env["PLAID_ENV"] ?? "").toLowerCase();
  return Boolean(process.env["PLAID_CLIENT_ID"] && process.env["PLAID_SECRET"] && HOSTS[env]);
}

export function plaidEnv(): string {
  return (process.env["PLAID_ENV"] ?? "sandbox").toLowerCase();
}

async function call<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const { clientId, secret, host } = creds();
  const res = await fetch(`${host}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let code = "";
    try {
      code = (JSON.parse(text) as { error_code?: string }).error_code ?? "";
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`plaid:${res.status}:${code || text.slice(0, 160)}`);
  }
  return JSON.parse(text) as T;
}

/* ------------------------------- link tokens ------------------------------- */

/** Short-lived token the browser hands to Plaid Link. Safe to send to a client. */
export async function createLinkToken(clientUserId: string, redirectUri?: string): Promise<string> {
  const out = await call<{ link_token: string }>("/link/token/create", {
    user: { client_user_id: clientUserId },
    client_name: "SOLIQ",
    products: ["transactions"],
    country_codes: ["US"],
    language: "en",
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  });
  return out.link_token;
}

/** Exchange the one-time `public_token` from Link for a durable access token. */
export async function exchangePublicToken(
  publicToken: string,
): Promise<{ accessToken: string; itemId: string }> {
  const out = await call<{ access_token: string; item_id: string }>("/item/public_token/exchange", {
    public_token: publicToken,
  });
  return { accessToken: out.access_token, itemId: out.item_id };
}

/** Detach the Item at Plaid so we stop being billed and stop holding access. */
export async function removeItem(accessToken: string): Promise<void> {
  await call("/item/remove", { access_token: accessToken });
}

/* --------------------------------- reading -------------------------------- */

export type BankAccount = {
  id: string;
  name: string | null;
  officialName: string | null;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  currency: string;
  available: number | null;
  current: number | null;
};

export type BankInstitution = { id: string | null; name: string | null };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

type RawAccount = {
  account_id: string;
  name?: string | null;
  official_name?: string | null;
  mask?: string | null;
  type?: string | null;
  subtype?: string | null;
  balances?: {
    available?: number | null;
    current?: number | null;
    iso_currency_code?: string | null;
    unofficial_currency_code?: string | null;
  } | null;
};

export async function accountBalances(accessToken: string): Promise<{
  accounts: BankAccount[];
  itemId: string | null;
  institutionId: string | null;
}> {
  const out = await call<{ accounts?: RawAccount[]; item?: { item_id?: string; institution_id?: string | null } }>(
    "/accounts/balance/get",
    { access_token: accessToken },
  );
  return {
    itemId: out.item?.item_id ?? null,
    institutionId: out.item?.institution_id ?? null,
    accounts: (out.accounts ?? []).map((a) => ({
      id: a.account_id,
      name: a.name ?? null,
      officialName: a.official_name ?? null,
      mask: a.mask ?? null,
      type: a.type ?? null,
      subtype: a.subtype ?? null,
      currency: a.balances?.iso_currency_code ?? a.balances?.unofficial_currency_code ?? "USD",
      available: num(a.balances?.available),
      current: num(a.balances?.current),
    })),
  };
}

export async function institution(institutionId: string): Promise<BankInstitution> {
  try {
    const out = await call<{ institution?: { institution_id?: string; name?: string } }>("/institutions/get_by_id", {
      institution_id: institutionId,
      country_codes: ["US"],
    });
    return { id: out.institution?.institution_id ?? institutionId, name: out.institution?.name ?? null };
  } catch {
    return { id: institutionId, name: null };
  }
}
