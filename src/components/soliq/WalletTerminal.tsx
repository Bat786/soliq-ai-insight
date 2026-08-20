import "@/lib/node-globals";
import { useWallet } from "@solana/wallet-adapter-react";
import { Link } from "@tanstack/react-router";
import { Copy, ExternalLink, Eye, Link2Off, Star, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HeaderWallets } from "@/components/soliq/HeaderWallets";
import { useDetectedWallets, useWallets, walletProviders } from "@/hooks/use-wallets";

const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`;
const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function WalletTerminal() {
  const { isSignedIn, wallets, balances, balanceFor, totalUsd, connect, watch, remove, makePrimary } = useWallets();
  const detected = useDetectedWallets();
  const solanaAdapter = useWallet();
  const [watchAddress, setWatchAddress] = useState("");


  return (
    <div className="space-y-4">
      {!isSignedIn ? (
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Wallet className="size-4 text-primary" /> Connect now, save to your account after sign-in
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Wallet links are read-only and stored privately on your account — SOLIQ never requests transactions.
            </p>
          </div>
          <Button asChild variant="hero" size="sm">
            <Link to="/auth">Create free account</Link>
          </Button>
        </div>
      ) : (
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
      )}


      <div className="panel p-5">
        <p className="text-sm font-semibold">Connect a Solana wallet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Phantom, Solflare, Backpack and Magic Eden Wallet register through the Wallet Standard and are detected
          automatically. Open SOLIQ in its own browser tab — extensions do not inject into embedded preview frames.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <HeaderWallets sync={false} />
          {solanaAdapter.connected && solanaAdapter.publicKey && (
            <span className="num text-[11px] text-muted-foreground">
              {solanaAdapter.wallet?.adapter.name} · {short(solanaAdapter.publicKey.toBase58())}
            </span>
          )}
        </div>
      </div>

      <div className="panel p-5">
        <p className="text-sm font-semibold">Connect an EVM wallet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Approve the connection request in your wallet. SOLIQ only reads your public address — never a signature that
          moves funds.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {walletProviders.map((p) => {
            const ready = p.universal || detected[p.id];
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
                      {p.universal ? "QR READY" : ready ? "DETECTED" : "TAP TO CONNECT"}
                    </span>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{p.blurb}</p>
                  {!ready && !p.universal && (
                    <a
                      className="text-[10px] text-muted-foreground underline hover:text-foreground"
                      href={p.site}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Don't have it? Install {p.name} <ExternalLink className="inline size-2.5" />
                    </a>
                  )}
                </div>
                <Button size="sm" variant="hero" disabled={connect.isPending} onClick={() => connect.mutate(p)}>
                  Connect
                </Button>
              </div>
            );
          })}

        </div>

        <form
          className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!watchAddress.trim()) return;
            watch.mutate(watchAddress, { onSuccess: () => setWatchAddress("") });
          }}
        >
          <div className="min-w-0 flex-1">
            <label className="text-[11px] font-medium text-muted-foreground" htmlFor="watch-address">
              Or track any public address (Solana or EVM)
            </label>
            <Input
              id="watch-address"
              value={watchAddress}
              onChange={(event) => setWatchAddress(event.target.value)}
              placeholder="So1111… or 0xabc…"
              className="num mt-1"
            />
          </div>
          <Button type="submit" size="sm" variant="subtle" className="mt-5" disabled={watch.isPending}>
            <Eye className="size-3.5" /> Track
          </Button>
        </form>
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
                  {!!bal?.tokens?.length && (
                    <div className="mt-1 w-full border-t border-border/60 pt-2">
                      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">TOKEN HOLDINGS</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {bal.tokens.slice(0, 8).map((t) => (
                          <span
                            key={`${w.id}-${t.symbol}-${t.amount}`}
                            className="num rounded-lg border border-border bg-surface-2/60 px-2 py-1 text-[10px]"
                            title={t.name}
                          >
                            {t.symbol}{" "}
                            <span className="text-muted-foreground">
                              {t.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
