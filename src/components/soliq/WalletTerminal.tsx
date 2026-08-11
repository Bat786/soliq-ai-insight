import { Link } from "@tanstack/react-router";
import { Copy, ExternalLink, Link2Off, Star, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useDetectedWallets, useWallets, walletProviders } from "@/hooks/use-wallets";

const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`;
const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function WalletTerminal() {
  const { isSignedIn, wallets, balances, balanceFor, totalUsd, connect, remove, makePrimary } = useWallets();
  const detected = useDetectedWallets();

  if (!isSignedIn) {
    return (
      <div className="panel p-6 text-center">
        <Wallet className="mx-auto size-6 text-primary" />
        <p className="mt-3 text-sm font-medium">Sign in to link wallets</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Wallet links are read-only and stored privately on your account — AETHRON never requests transactions.
        </p>
        <Button asChild variant="hero" size="sm" className="mt-4">
          <Link to="/auth">Create free account</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Tracked on-chain value</p>
            <p className="num text-3xl font-bold">{usd(totalUsd)}</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {wallets.length} wallet{wallets.length === 1 ? "" : "s"} · {balances.length} synced · read-only
          </p>
        </div>
      </div>

      <div className="panel p-5">
        <p className="text-sm font-semibold">Connect a wallet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Approve the connection request in your extension. AETHRON only reads your public address.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {walletProviders.map((p) => {
            const ready = detected[p.id];
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 p-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {p.name}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                        ready ? "bg-bull/15 text-bull" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {ready ? "DETECTED" : "NOT FOUND"}
                    </span>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{p.blurb}</p>
                </div>
                {ready ? (
                  <Button size="sm" variant="hero" disabled={connect.isPending} onClick={() => connect.mutate(p)}>
                    Connect
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="subtle">
                    <a href={p.site} target="_blank" rel="noreferrer noopener">
                      Install <ExternalLink className="size-3" />
                    </a>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel p-5">
        <p className="text-sm font-semibold">Linked wallets</p>
        {wallets.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No wallets linked yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {wallets.map((w) => {
              const bal = balanceFor(w.address);
              return (
                <div
                  key={w.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {w.provider}
                      <span className="rounded bg-primary/12 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-primary">
                        {w.chain === "solana" ? "SOLANA" : "EVM"}
                      </span>
                      {w.is_primary && <Star className="size-3 text-warn" />}
                    </p>
                    <button
                      className="num mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        void navigator.clipboard.writeText(w.address);
                        toast.success("Address copied");
                      }}
                    >
                      {short(w.address)} <Copy className="size-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="num text-sm font-semibold">{bal ? usd(bal.usd) : "—"}</p>
                      <p className="num text-[11px] text-muted-foreground">
                        {bal ? `${bal.native.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${bal.symbol}` : "syncing"}
                      </p>
                    </div>
                    {!w.is_primary && (
                      <Button size="sm" variant="ghost" onClick={() => makePrimary.mutate(w.id)}>
                        <Star className="size-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(w.id)}>
                      <Link2Off className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
