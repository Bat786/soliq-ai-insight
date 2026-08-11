import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Bot, Newspaper, Sparkles } from "lucide-react";

import { AppShell } from "@/components/soliq/AppShell";
import { Delta, SectionTitle, Sparkline, StatCard } from "@/components/soliq/primitives";
import { WhaleSignalCard, WhaleStrip } from "@/components/soliq/WhaleSignal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCryptoDesk } from "@/hooks/use-dex";
import { useMarketNews } from "@/hooks/use-news";
import { useTapeBoard } from "@/hooks/use-tape";
import type { MarketRow } from "@/lib/tape.server";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SOLIQ — powered by AETHRON, Solana Blockchain Intelligence Engine" },
      {
        name: "description",
        content:
          "SOLIQ is a live AI market intelligence terminal: real-time crypto, stocks and futures tape, whale flow, Solana DEX intelligence and an AI market briefing.",
      },
      { property: "og:title", content: "SOLIQ — powered by AETHRON" },
      {
        property: "og:description",
        content: "Live crypto, stocks and futures desks with whale flow, Solana DEX intelligence and AI research.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
const price = (n: number) =>
  n < 1 ? n.toPrecision(4) : n.toLocaleString(undefined, { maximumFractionDigits: 2 });

function LiveRow({ row }: { row: MarketRow }) {
  return (
    <Link
      to="/asset/$id"
      params={{ id: row.key }}
      className="flex items-center gap-3 border-b border-border/50 py-2.5 last:border-0"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.code}</p>
        <p className="truncate text-[11px] text-muted-foreground">{row.name}</p>
      </div>
      <Sparkline data={row.spark} up={row.changePct >= 0} className="h-8 w-20" />
      <div className="w-24 text-right">
        <p className="num text-sm">{price(row.last)}</p>
        <p className={`num text-[11px] ${row.changePct >= 0 ? "text-bull" : "text-bear"}`}>{pct(row.changePct)}</p>
      </div>
    </Link>
  );
}

function Panel({ title, subtitle, rows, loading }: { title: string; subtitle: string; rows: MarketRow[]; loading: boolean }) {
  return (
    <div className="panel p-5">
      <SectionTitle title={title} subtitle={subtitle} />
      {loading && !rows.length ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        rows.map((r) => <LiveRow key={r.key} row={r} />)
      )}
    </div>
  );
}

function Home() {
  const crypto = useTapeBoard("crypto");
  const stocks = useTapeBoard("stocks");
  const futures = useTapeBoard("futures");
  const indices = useTapeBoard("indices");
  const desk = useCryptoDesk();
  const news = useMarketNews(undefined, 10);

  const all = [
    ...(crypto.data?.rows ?? []),
    ...(stocks.data?.rows ?? []),
    ...(futures.data?.rows ?? []),
  ].filter((r) => Number.isFinite(r.last) && r.last > 0);

  const loading = crypto.isLoading || stocks.isLoading || futures.isLoading;
  const gainers = [...all].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const losers = [...all].sort((a, b) => a.changePct - b.changePct).slice(0, 5);
  const trending = [...all].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 5);

  const spx = indices.data?.rows.find((r) => r.key === "SPX");
  const btc = crypto.data?.rows.find((r) => r.key === "BTCUSD");
  const breadth = all.length ? (all.filter((r) => r.changePct >= 0).length / all.length) * 100 : 0;
  const movers = desk.data?.movers ?? [];

  const stats = [
    { label: "S&P 500", value: spx ? price(spx.last) : "—", delta: spx?.changePct ?? 0 },
    { label: "Bitcoin", value: btc ? `$${price(btc.last)}` : "—", delta: btc?.changePct ?? 0 },
    { label: "Market breadth", value: `${breadth.toFixed(0)}% up`, delta: breadth - 50 },
    { label: "Instruments live", value: String(all.length), delta: 0 },
  ];

  return (
    <AppShell>
      <section className="hero-bg panel relative overflow-hidden p-6 lg:p-8">
        <p className="text-[11px] tracking-[0.2em] text-primary uppercase">SOLIQ · powered by AETHRON</p>
        <h1 className="mt-2 max-w-xl text-2xl font-bold lg:text-4xl">
          The market, <span className="text-gradient">decoded</span> in real time.
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Live crypto, stocks, futures and Solana DEX intelligence — scanned, scored and summarised by the AETHRON
          engine.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="hero">
            <Link to="/scanner">Open scanner dashboard</Link>
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
        {stats.map((s) => (
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
              <p className="text-[11px] text-muted-foreground">Live tape read · AETHRON engine</p>
            </div>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed">
            <li className="rounded-lg border border-border bg-surface-2/50 p-3">
              Breadth across our live universe is <span className="text-primary">{breadth.toFixed(0)}% positive</span>
              {gainers[0] ? (
                <>
                  , led by <span className="text-primary">{gainers[0].code}</span> at {pct(gainers[0].changePct)}.
                </>
              ) : (
                "."
              )}
            </li>
            {losers[0] && (
              <li className="rounded-lg border border-border bg-surface-2/50 p-3">
                Weakest tape sits in <span className="text-primary">{losers[0].code}</span> at{" "}
                {pct(losers[0].changePct)} — watch for continuation before adding risk.
              </li>
            )}
            {movers[0] && (
              <li className="rounded-lg border border-border bg-surface-2/50 p-3">
                Solana flow: <span className="text-primary">{movers[0].symbol}</span> is printing{" "}
                {movers[0].buyPressure.toFixed(0)}% buy pressure with an AETHRON score of {movers[0].score}.
              </li>
            )}
          </ul>
        </div>

        <div>
          <WhaleSignalCard />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title="Most active" subtitle="Largest absolute moves" rows={trending} loading={loading} />
        <Panel title="Biggest gainers" subtitle="Live session" rows={gainers} loading={loading} />
        <Panel title="Biggest losers" subtitle="Live session" rows={losers} loading={loading} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="panel p-5">
          <SectionTitle
            title="Solana DEX conviction"
            subtitle="Jupiter organic score + DexScreener flow"
            action={<Sparkles className="size-4 text-primary" aria-hidden />}
          />
          {desk.isLoading && !movers.length ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {movers.slice(0, 4).map((t) => (
                <div key={t.mint} className="rounded-xl border border-border bg-surface-2/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">
                      {t.name} <span className="num text-muted-foreground">{t.symbol}</span>
                    </p>
                    <span className="num text-xs text-primary">{t.score}</span>
                  </div>
                  <p className="num mt-1 text-xs text-muted-foreground">
                    ${price(t.price)} ·{" "}
                    <span className={t.changePct >= 0 ? "text-bull" : "text-bear"}>{pct(t.changePct)}</span> ·{" "}
                    {t.buyPressure.toFixed(0)}% buys
                  </p>
                </div>
              ))}
              {!movers.length && <p className="text-xs text-muted-foreground">DEX feed syncing…</p>}
            </div>
          )}
          <Button asChild variant="subtle" size="sm" className="mt-4 w-full">
            <Link to="/crypto">Open Crypto Desk</Link>
          </Button>
        </div>

        <div className="panel p-5">
          <SectionTitle
            title="Live news wire"
            subtitle="Massive market news API"
            action={<Newspaper className="size-4 text-muted-foreground" />}
          />
          {news.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : news.data?.length ? (
            <div className="divide-y divide-border/60">
              {news.data.map((n) => (
                <a
                  key={n.id}
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-3 py-3 hover:opacity-80"
                >
                  {n.sentiment && (
                    <span
                      className={`mt-0.5 rounded-md px-2 py-0.5 text-[10px] ${
                        n.sentiment === "positive"
                          ? "bg-bull/12 text-bull"
                          : n.sentiment === "negative"
                            ? "bg-bear/12 text-bear"
                            : "bg-primary/12 text-primary"
                      }`}
                    >
                      {n.sentiment}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">{n.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {n.publisher}
                      {n.tickers.length ? ` · ${n.tickers.join(" ")}` : ""}
                    </p>
                  </div>
                  <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">News wire is rate limited right now — retrying shortly.</p>
          )}
        </div>
      </div>

      <div className="mt-5 panel p-5">
        <SectionTitle title="Your portfolio" subtitle="Linked wallets and tracked positions" />
        <Delta value={0} className="mt-1" />
        <p className="mt-2 text-xs text-muted-foreground">
          Connect a Solana or EVM wallet to stream live balances, holdings and PnL into this panel.
        </p>
        <div className="mt-4 flex gap-2">
          <Button asChild variant="hero" size="sm">
            <Link to="/wallets">Connect wallet</Link>
          </Button>
          <Button asChild variant="subtle" size="sm">
            <Link to="/portfolio">Open portfolio</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
