import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mint a short-lived Plaid Link token for the signed-in member. This is the
 * only Plaid value the browser ever receives — access tokens stay server-side.
 */
export const createBankLinkToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { redirectUri?: string } | undefined) => ({ redirectUri: input?.redirectUri ?? undefined }))
  .handler(async ({ data, context }) => {
    const { bankLinkToken } = await import("@/lib/bank.server");
    try {
      return { linkToken: await bankLinkToken(context.userId, data.redirectUri), error: null as string | null };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      return {
        linkToken: null as string | null,
        error: /not-configured/.test(msg)
          ? "Bank linking is not configured on this deployment."
          : "Plaid could not start the connection. Try again shortly.",
      };
    }
  });

/** Exchange the one-time public token from Plaid Link for a stored access token. */
export const exchangeBankPublicToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { publicToken: string }) => {
    const publicToken = String(input?.publicToken ?? "").trim();
    if (!publicToken) throw new Error("publicToken is required");
    return { publicToken };
  })
  .handler(async ({ data, context }) => {
    const { linkBankAccount } = await import("@/lib/bank.server");
    try {
      const out = await linkBankAccount(context.userId, data.publicToken);
      return { ok: true as const, institution: out.institution, accounts: out.accounts, error: null as string | null };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      return {
        ok: false as const,
        institution: null as string | null,
        accounts: 0,
        error: /not-configured/.test(msg)
          ? "Bank linking is not configured on this deployment."
          : "Plaid rejected the connection. Please try linking again.",
      };
    }
  });

/** Live balances for every institution the member has linked. */
export const getBankSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadBankSnapshot } = await import("@/lib/bank.server");
    return loadBankSnapshot(context.userId);
  });

/** Detach one institution and delete its stored credential. */
export const unlinkBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { connectionId: string }) => {
    const connectionId = String(input?.connectionId ?? "").trim();
    if (!connectionId) throw new Error("connectionId is required");
    return { connectionId };
  })
  .handler(async ({ data, context }) => {
    const { unlinkBankConnection } = await import("@/lib/bank.server");
    await unlinkBankConnection(context.userId, data.connectionId);
    return { ok: true as const };
  });
