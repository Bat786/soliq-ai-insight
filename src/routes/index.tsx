import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, ArrowUpRight, Newspaper, Sparkles } from "lucide-react";

import { AppShell } from "@/components/soliq/AppShell";
import { AssetRow, Delta, ScoreRing, SectionTitle, Sparkline, StatCard } from "@/components/soliq/primitives";
import { WhaleSignalCard, WhaleStrip } from "@/components/soliq/WhaleSignal";
import { Button } from "@/components/ui/button";
import {
  aiPicks,
  fmtPct,
  fmtUsd,
  gainers,
  losers,
  marketStats,
  news,
  portfolioCost,
  portfolioSeries,
  portfolioValue,
  trending,
} from "@/lib/market-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SOLIQ — AI Market Intelligence & Investing Terminal" },
      {
        name: "description",
        content:
          "SOLIQ is an AI-powered market intelligence platform: scan crypto markets, track portfolios, build watchlists and get daily AI market briefings.",
      },
      { property: "og:title", content: "SOLIQ — AI Market Intelligence & Investing Terminal" },
      {
        property: "og:description",
        content: "Scan markets, track portfolios and get AI-powered crypto insights in one premium terminal.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const pnl = ((portfolioValue - portfolioCost) / portfolioCost) * 100;

  return (
    <AppShell>
      <section className="hero-bg panel relative overflow-hidden p-6 lg:p-8">
        <p className="text-[11px] tracking-[0.2em] text-primary uppercase">Good evening, explorer</p>
        <h1 className="mt-2 max-w-xl text-2xl font-bold lg:text-4xl">
          The market, <span className="text-gradient">decoded</span> in real time.
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Intelligence across 14,000+ assets — scanned, scored and summarised by SOLIQ AI.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="hero">
            <Link to="/scanner">Run market scan</Link>
          </Button>
          <Button asChild variant="subtle">
            <Link to="/assistant">Ask SOLIQ AI</Link>
          </Button>
        </div>
      </section>

      <div className="mt-4">
        <WhaleStrip />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {marketStats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} delta={s.delta} />
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Bot className="size-4.5" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold">AI Market Briefing</h2>
              <p className="text-[11px] text-muted-foreground">Generated 6 minutes ago · SOLIQ AI</p>
            </div>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed">
            <li className="rounded-lg border border-border bg-surface-2/50 p-3">
              <span className="text-primary">Bitcoin</span> momentum is increasing on volume expansion — spot demand is
              absorbing supply near the range high, and open interest is at a 3-month peak.
            </li>
            <li className="rounded-lg border border-border bg-surface-2/50 p-3">
              <span className="text-primary">SOL</span> shows bullish accumulation patterns: funding reset while spot
              volume kept climbing. Structure invalidates below $232.
            </li>
            <li className="rounded-lg border border-border bg-surface-2/50 p-3">
              Memecoin breadth is narrowing. Risk scores above 70 across the cohort — size accordingly.
            </li>
          </ul>
        </div>

        <div>
          <WhaleSignalCard />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="panel p-5">
          <SectionTitle title="Your portfolio" subtitle="Demo holdings" />
          <p className="num font-display text-2xl font-bold">{fmtUsd(portfolioValue)}</p>
          <Delta value={pnl} className="mt-1" />
          <Sparkline data={portfolioSeries} up={pnl >= 0} className="mt-3 h-16" />
          <Button asChild variant="subtle" size="sm" className="mt-4 w-full">
            <Link to="/portfolio">Open portfolio</Link>
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="panel p-5">
          <SectionTitle title="Trending" subtitle="Social + volume momentum" />
          {trending.map((a) => (
            <AssetRow key={a.id} asset={a} />
          ))}
        </div>
        <div className="panel p-5">
          <SectionTitle title="Biggest gainers" subtitle="24 hours" />
          {gainers.map((a) => (
            <AssetRow key={a.id} asset={a} />
          ))}
        </div>
        <div className="panel p-5">
          <SectionTitle title="Biggest losers" subtitle="24 hours" />
          {losers.map((a) => (
            <AssetRow key={a.id} asset={a} />
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="panel p-5">
          <SectionTitle
            title="Personalised for you"
            subtitle="AI picks based on your watchlists"
            action={
              <Sparkles className="size-4 text-primary" aria-hidden />
            }
          />
          <div className="space-y-3">
            {aiPicks.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-surface-2/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {a.name} <span className="num text-muted-foreground">{a.symbol}</span>
                  </p>
                  <ScoreRing score={a.score} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.reason}</p>
                <p className="num mt-2 text-xs">
                  {fmtUsd(a.price)} · <span className={a.change24h >= 0 ? "text-bull" : "text-bear"}>{fmtPct(a.change24h)}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <SectionTitle title="News highlights" subtitle="Curated market wire" action={<Newspaper className="size-4 text-muted-foreground" />} />
          <div className="divide-y divide-border/60">
            {news.map((n) => (
              <article key={n.title} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 rounded-md bg-primary/12 px-2 py-0.5 text-[10px] text-primary">{n.tag}</span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {n.source} · {n.time}
                  </p>
                </div>
                <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
              </article>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
