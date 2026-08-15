import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Wallet } from "lucide-react";
import { useMemo } from "react";

import { AppShell } from "@/components/soliq/AppShell";
import { BankAccountsPanel } from "@/components/soliq/BankAccountsPanel";
import { AssetPill, Delta, SectionTitle, StatCard } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { useMarket } from "@/hooks/use-market";
import { useWallets } from "@/hooks/use-wallets";
import { fmtNum, fmtPct, fmtUsd } from "@/lib/format";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio Tracker — SOLIQ" },
      {
        name: "description",
        content:
          "Track linked Solana and EVM wallet holdings, allocation and live 24h performance with the SOLIQ portfolio tracker.",
      },
      { property: "og:title", content: "Portfolio Tracker — SOLIQ" },
      { property: "og:description", content: "Live wallet holdings, allocation and performance in one view." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Portfolio,
});

type Holding = {
  key: string;
  symbol: string;
  name: string;
  amount: number;
  price: number;
  value: number;
  change24h: number;
};

function Portfolio() {
  const { isSignedIn, wallets, balances, totalUsd, loading } = useWallets();
  const market = useMarket();
  const universe = market.data?.rows ?? [];

  const holdings = useMemo<Holding[]>(() => {
    const bySymbol = new Map<string, Holding>();
    const quote = (symbol: string) =>
      universe.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase());

    const add = (symbol: string, name: string, amount: number, usdHint?: number) => {
      if (!amount) return;
      const live = quote(symbol);
      const price = live?.price ?? (usdHint && amount ? usdHint / amount : 0);
      const value = usdHint ?? price * amount;
      const existing = bySymbol.get(symbol.toUpperCase());
      if (existing) {
        existing.amount += amount;
        existing.value += value;
        return;
      }
      bySymbol.set(symbol.toUpperCase(), {
        key: symbol.toUpperCase(),
        symbol: symbol.toUpperCase(),
        name: live?.name ?? name,
        amount,
        price,
        value,
        change24h: live?.change24h ?? 0,
      });
    };

    for (const b of balances) {
      add(b.symbol, b.symbol === "SOL" ? "Solana" : "Ethereum", b.native, b.usd);
      for (const t of b.tokens ?? []) add(t.symbol, t.name ?? t.symbol, t.amount);
    }
    return [...bySymbol.values()].sort((a, b) => b.value - a.value);
  }, [balances, universe]);

  const value = holdings.reduce((s, h) => s + h.value, 0) || totalUsd;
  const change24hUsd = holdings.reduce((s, h) => s + (h.value * h.change24h) / 100, 0);
  const change24hPct = value > 0 ? (change24hUsd / value) * 100 : 0;
  const ranked = [...holdings].filter((h) => h.change24h !== 0).sort((a, b) => b.change24h - a.change24h);
  const best = ranked.slice(0, 3);
  const worst = ranked.slice(-3).reverse();

  return (
    <AppShell>
      <h1 className="flex items-center gap-2 text-xl font-bold lg:text-2xl">
        <Wallet className="size-5 text-primary" /> Portfolio
      </h1>
      <p className="text-sm text-muted-foreground">
        Live read-only holdings from your linked Solana and EVM wallets, priced against the market tape.
      </p>

      <BankAccountsPanel />



      {!isSignedIn || wallets.length === 0 ? (
        <div className="panel mt-5 p-8 text-center">
          <Wallet className="mx-auto size-6 text-primary" />
          <p className="mt-3 text-sm font-medium">
            {isSignedIn ? "No wallets linked yet" : "Sign in and link a wallet"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect Phantom, Solflare, Backpack or MetaMask — SOLIQ reads balances only, never signs transactions.
          </p>
          <Button asChild variant="hero" size="sm" className="mt-4">
            <Link to={isSignedIn ? "/wallets" : "/auth"}>{isSignedIn ? "Link a wallet" : "Create free account"}</Link>
          </Button>
        </div>
      ) : loading && !holdings.length ? (
        <div className="panel mt-5 flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Syncing wallet balances…
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <section className="panel p-5">
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Total on-chain value</p>
              <p className="num font-display text-3xl font-bold">{fmtUsd(value)}</p>
              <div className="mt-1 flex items-center gap-3">
                <Delta value={change24hPct} />
                <span className="num text-xs text-muted-foreground">{fmtUsd(change24hUsd)} last 24h</span>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {wallets.length} wallet{wallets.length === 1 ? "" : "s"} · {holdings.length} assets · balances refresh
                automatically
              </p>
            </section>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="24h change" value={fmtUsd(change24hUsd)} delta={change24hPct} />
              <StatCard label="Assets held" value={String(holdings.length)} />
              <StatCard label="Wallets" value={String(wallets.length)} />
              <StatCard
                label="Largest position"
                value={holdings[0] ? `${holdings[0].symbol} ${fmtUsd(holdings[0].value)}` : "—"}
              />
            </div>
          </div>

          <div className="panel mt-5 p-5">
            <SectionTitle title="Holdings" subtitle="Live quantity, price and value from your linked wallets" />
            <div className="scroll-none -mx-1 overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="pb-2 font-medium">Asset</th>
                    <th className="pb-2 text-right font-medium">Quantity</th>
                    <th className="pb-2 text-right font-medium">Price</th>
                    <th className="pb-2 text-right font-medium">Value</th>
                    <th className="pb-2 text-right font-medium">24h</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.key} className="border-t border-border/60">
                      <td className="py-3">
                        <AssetPill asset={h} />
                      </td>
                      <td className="num py-3 text-right">{fmtNum(h.amount)}</td>
                      <td className="num py-3 text-right">{h.price ? fmtUsd(h.price) : "—"}</td>
                      <td className="num py-3 text-right">{h.value ? fmtUsd(h.value) : "—"}</td>
                      <td className="py-3 text-right">
                        <p className={`num text-sm ${h.change24h >= 0 ? "text-bull" : "text-bear"}`}>
                          {h.change24h ? fmtPct(h.change24h) : "—"}
                        </p>
                      </td>
                    </tr>
                  ))}
                  {!holdings.length && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                        No balances found on the linked wallets yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div className="panel p-5">
              <SectionTitle title="Allocation" />
              <div className="space-y-3">
                {holdings.slice(0, 8).map((h) => {
                  const pct = value > 0 ? (h.value / value) * 100 : 0;
                  return (
                    <div key={h.key}>
                      <div className="flex justify-between text-xs">
                        <span className="num">{h.symbol}</span>
                        <span className="num text-muted-foreground">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="panel p-5">
              <SectionTitle title="Best 24h" />
              {best.map((h) => (
                <div key={h.key} className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
                  <AssetPill asset={h} />
                  <Delta value={h.change24h} />
                </div>
              ))}
              {!best.length && <p className="py-3 text-xs text-muted-foreground">No priced movers yet.</p>}
            </div>
            <div className="panel p-5">
              <SectionTitle title="Worst 24h" />
              {worst.map((h) => (
                <div key={h.key} className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
                  <AssetPill asset={h} />
                  <Delta value={h.change24h} />
                </div>
              ))}
              {!worst.length && <p className="py-3 text-xs text-muted-foreground">No priced movers yet.</p>}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
