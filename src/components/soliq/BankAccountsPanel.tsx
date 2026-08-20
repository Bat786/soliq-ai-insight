import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Landmark, Link2Off, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { SectionTitle } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-soliq-account";
import { createBankLinkToken, exchangeBankPublicToken, getBankSnapshot, unlinkBank } from "@/lib/bank.functions";
import { fmtUsd } from "@/lib/format";

const PLAID_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
let plaidScriptPromise: Promise<PlaidGlobal> | null = null;

type PlaidHandler = { open: () => void; destroy: () => void };
type PlaidGlobal = {
  create: (opts: {
    token: string;
    onSuccess: (publicToken: string) => void;
    onExit: (err: { display_message?: string } | null) => void;
  }) => PlaidHandler;
};

/** Load Plaid Link's script once, on demand (never during SSR). */
function loadPlaid(): Promise<PlaidGlobal> {
  const existing = (window as unknown as { Plaid?: PlaidGlobal }).Plaid;
  if (existing) return Promise.resolve(existing);
  if (plaidScriptPromise) return plaidScriptPromise;
  plaidScriptPromise = new Promise((resolve, reject) => {
    const loadedTag = document.querySelector<HTMLScriptElement>(`script[src="${PLAID_SCRIPT}"]`);
    const tag = document.createElement("script");
    tag.src = PLAID_SCRIPT;
    tag.async = true;
    tag.onload = () => {
      const plaid = (window as unknown as { Plaid?: PlaidGlobal }).Plaid;
      plaid ? resolve(plaid) : reject(new Error("plaid-link-unavailable"));
    };
    tag.onerror = () => {
      plaidScriptPromise = null;
      reject(new Error("plaid-script-failed"));
    };
    if (loadedTag) {
      loadedTag.addEventListener("load", tag.onload as EventListener, { once: true });
      loadedTag.addEventListener("error", tag.onerror as EventListener, { once: true });
    } else {
      document.head.appendChild(tag);
    }
  });
  return plaidScriptPromise;
}

/**
 * Bank & cash accounts linked through Plaid. Balances come from a server
 * function; the browser only ever handles a short-lived link token.
 */
export function BankAccountsPanel() {
  const { isSignedIn } = useSession();
  const queryClient = useQueryClient();
  const fetchSnapshot = useServerFn(getBankSnapshot);
  const mintToken = useServerFn(createBankLinkToken);
  const exchange = useServerFn(exchangeBankPublicToken);
  const unlink = useServerFn(unlinkBank);
  const [opening, setOpening] = useState(false);

  const snapshot = useQuery({
    queryKey: ["bank-snapshot"],
    queryFn: () => fetchSnapshot(),
    enabled: isSignedIn,
    staleTime: 60_000,
  });

  const exchangeMutation = useMutation({
    mutationFn: (publicToken: string) => exchange({ data: { publicToken } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error ?? "Could not link the account.");
        return;
      }
      toast.success(`${res.institution ?? "Institution"} linked · ${res.accounts} account(s)`);
      void queryClient.invalidateQueries({ queryKey: ["bank-snapshot"] });
    },
    onError: () => toast.error("Could not finish linking the account."),
  });

  const unlinkMutation = useMutation({
    mutationFn: (connectionId: string) => unlink({ data: { connectionId } }),
    onSuccess: () => {
      toast.success("Institution unlinked");
      void queryClient.invalidateQueries({ queryKey: ["bank-snapshot"] });
    },
    onError: () => toast.error("Could not unlink the institution."),
  });

  const openLink = useCallback(async () => {
    setOpening(true);
    try {
      const [{ linkToken, error }, plaid] = await Promise.all([
        mintToken({ data: {} }),
        loadPlaid(),
      ]);
      if (!linkToken) {
        toast.error(error ?? "Bank linking is unavailable right now.");
        return;
      }
      const handler = plaid.create({
        token: linkToken,
        onSuccess: (publicToken) => {
          exchangeMutation.mutate(publicToken);
          handler.destroy();
        },
        onExit: (err) => {
          if (err?.display_message) toast.error(err.display_message);
          handler.destroy();
        },
      });
      handler.open();
    } catch {
      toast.error("Plaid Link could not be opened. Check your connection and retry.");
    } finally {
      setOpening(false);
    }
  }, [exchangeMutation, mintToken]);

  const env = snapshot.data;
  const institutions = env?.data?.institutions ?? [];
  const totals = env?.data?.totals;
  const busy = opening || exchangeMutation.isPending;

  return (
    <section className="panel mt-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle
          title="Bank & cash accounts"
          subtitle="Read-only balances from your bank, brokerage cash and credit lines via Plaid"
        />
        <Button size="sm" variant="hero" disabled={!isSignedIn || busy} onClick={() => void openLink()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />}
          {busy ? "Connecting…" : "Connect a bank"}
        </Button>
      </div>

      {!isSignedIn ? (
        <p className="text-xs text-muted-foreground">Sign in to link a bank or cash account.</p>
      ) : snapshot.isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Loading linked institutions…
        </p>
      ) : (
        <>
          {totals && totals.accounts > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Cash</p>
                <p className="num font-display text-lg font-bold">{fmtUsd(totals.cash)}</p>
              </div>
              <div>
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Credit / loans</p>
                <p className="num font-display text-lg font-bold">{fmtUsd(totals.credit)}</p>
              </div>
              <div>
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Accounts</p>
                <p className="num font-display text-lg font-bold">{totals.accounts}</p>
              </div>
              <div>
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Institutions</p>
                <p className="num font-display text-lg font-bold">{totals.institutions}</p>
              </div>
            </div>
          )}

          {institutions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {env?.reason ?? "No bank linked yet — connect an account to stream balances."}
            </p>
          ) : (
            <div className="space-y-4">
              {institutions.map((inst) => (
                <div key={inst.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Building2 className="size-4 text-primary" />
                      {inst.name ?? "Linked institution"}
                      {inst.status !== "active" && (
                        <span className="text-[10px] text-bear uppercase">needs reconnect</span>
                      )}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={unlinkMutation.isPending}
                      onClick={() => unlinkMutation.mutate(inst.id)}
                    >
                      <Link2Off className="size-3.5" /> Unlink
                    </Button>
                  </div>
                  <div className="mt-2 divide-y divide-border/60">
                    {inst.accounts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span>
                          {a.name ?? a.officialName ?? "Account"}
                          {a.mask ? <span className="num text-muted-foreground"> ••{a.mask}</span> : null}
                          <span className="ml-2 text-[10px] text-muted-foreground uppercase">
                            {[a.type, a.subtype].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="num">{fmtUsd(a.current ?? a.available ?? 0)}</span>
                      </div>
                    ))}
                    {inst.accounts.length === 0 && (
                      <p className="py-2 text-xs text-muted-foreground">
                        Balances unavailable — reconnect this institution.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5 text-bull" /> SOLIQ never sees your bank credentials, and access tokens are
        stored server-side only — read access, no money movement.
      </p>
    </section>
  );
}
