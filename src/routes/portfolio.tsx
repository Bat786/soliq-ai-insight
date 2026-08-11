import { createFileRoute } from "@tanstack/react-router";
import { Plus, Wallet } from "lucide-react";

import { AppShell } from "@/components/soliq/AppShell";
import { AssetPill, Delta, SectionTitle, Sparkline, StatCard } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { fmtPct, fmtUsd, portfolio, portfolioCost, portfolioSeries, portfolioValue } from "@/lib/market-data";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio Tracker — SOLIQ" },
      {
        name: "description",
        content:
          "Track holdings, cost basis, allocation and profit/loss across timeframes with the SOLIQ portfolio tracker.",
      },
      { property: "og:title", content: "Portfolio Tracker — SOLIQ" },
      { property: "og:description", content: "Holdings, P&L, allocation and performance in one view." },
    ],
  }),
  component: Portfolio,
});

function Portfolio() {
  const pnl = portfolioValue - portfolioCost;
  const pnlPct = (pnl / portfolioCost) * 100;
  const sorted = [...portfolio].sort((a, b) => b.pnlPct - a.pnlPct);
  const best = sorted.slice(0, 2);
  const worst = sorted.slice(-2).reverse();

  return (
    <AppShell>
      <h1 className="flex items-center gap-2 text-xl font-bold lg:text-2xl">
        <Wallet className="size-5 text-primary" /> Portfolio
      </h1>
      <p className="text-sm text-muted-foreground">Demo portfolio · connect an account to sync real holdings.</p>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="panel p-5">
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Total value</p>
          <p className="num font-display text-3xl font-bold">{fmtUsd(portfolioValue)}</p>
          <div className="mt-1 flex items-center gap-3">
            <Delta value={pnlPct} />
            <span className="num text-xs text-muted-foreground">{fmtUsd(pnl)} all time</span>
          </div>
          <Sparkline data={portfolioSeries} up={pnl >= 0} className="mt-4 h-28" />
        </section>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="24h change" value={fmtUsd(portfolioValue * 0.031)} delta={3.1} />
          <StatCard label="7d change" value={fmtUsd(portfolioValue * 0.086)} delta={8.6} />
          <StatCard label="30d change" value={fmtUsd(portfolioValue * 0.174)} delta={17.4} />
          <StatCard label="Cost basis" value={fmtUsd(portfolioCost)} />
        </div>
      </div>

      <div className="mt-5 panel p-5">
        <SectionTitle
          title="Holdings"
          subtitle="Quantity, cost basis and unrealised P&L"
          action={
            <Button variant="hero" size="sm">
              <Plus className="size-4" /> Add holding
            </Button>
          }
        />
        <div className="scroll-none -mx-1 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="pb-2 font-medium">Asset</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Avg cost</th>
                <th className="pb-2 text-right font-medium">Value</th>
                <th className="pb-2 text-right font-medium">P&L</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((p) => (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="py-3">
                    <AssetPill asset={p.asset} />
                  </td>
                  <td className="num py-3 text-right">{p.qty.toLocaleString()}</td>
                  <td className="num py-3 text-right">{fmtUsd(p.costBasis)}</td>
                  <td className="num py-3 text-right">{fmtUsd(p.value)}</td>
                  <td className="py-3 text-right">
                    <p className={`num text-sm ${p.pnl >= 0 ? "text-bull" : "text-bear"}`}>{fmtUsd(p.pnl)}</p>
                    <p className={`num text-[11px] ${p.pnl >= 0 ? "text-bull" : "text-bear"}`}>{fmtPct(p.pnlPct)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="panel p-5">
          <SectionTitle title="Allocation" />
          <div className="space-y-3">
            {portfolio
              .slice()
              .sort((a, b) => b.value - a.value)
              .map((p) => {
                const pct = (p.value / portfolioValue) * 100;
                return (
                  <div key={p.id}>
                    <div className="flex justify-between text-xs">
                      <span className="num">{p.asset.symbol}</span>
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
          <SectionTitle title="Best performers" />
          {best.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
              <AssetPill asset={p.asset} />
              <Delta value={p.pnlPct} />
            </div>
          ))}
        </div>
        <div className="panel p-5">
          <SectionTitle title="Worst performers" />
          {worst.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
              <AssetPill asset={p.asset} />
              <Delta value={p.pnlPct} />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
