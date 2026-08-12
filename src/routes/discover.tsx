import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, GraduationCap, Loader2, Newspaper, Rocket, Sparkles, TrendingUp } from "lucide-react";

import { WhaleStrip } from "@/components/soliq/WhaleSignal";
import { AppShell } from "@/components/soliq/AppShell";
import { AssetRow, ScoreRing, SectionTitle } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { useCryptoDesk } from "@/hooks/use-dex";
import { useMarket } from "@/hooks/use-market";
import { useMarketNews } from "@/hooks/use-news";
import { fmtNum, fmtPct, fmtUsd } from "@/lib/format";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — Trending, AI Picks & New Launches | SOLIQ" },
      {
        name: "description",
        content:
          "Discover live trending markets, AI-selected opportunities, fresh Solana launches, trending metas and the live news wire on SOLIQ.",
      },
      { property: "og:title", content: "Discover — SOLIQ" },
      { property: "og:description", content: "Live trending markets, AI picks, new launches, metas and news." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Discover,
});

const education = [
  { title: "Investing 101: building your first thesis", level: "Beginner", mins: 8 },
  { title: "Reading volume profile like a desk trader", level: "Intermediate", mins: 12 },
  { title: "RSI, MACD and when indicators lie", level: "Intermediate", mins: 10 },
  { title: "Position sizing for high-volatility assets", level: "Advanced", mins: 14 },
];

const age = (createdAt: number) => {
  if (!createdAt) return "new";
  const days = (Date.now() - createdAt) / 86_400_000;
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h old`;
  return `${Math.round(days)}d old`;
};

function Discover() {
  const market = useMarket();
  const desk = useCryptoDesk();
  const news = useMarketNews(undefined, 8);

  const rows = market.data?.rows ?? [];
  const trending = [...rows].sort((a, b) => b.relVolume - a.relVolume).slice(0, 6);
  const aiPicks = [...rows].sort((a, b) => b.aiScore - a.aiScore).slice(0, 5);
  const fresh = (desk.data?.fresh ?? []).slice(0, 6);
  const metas = (desk.data?.metas ?? []).slice(0, 6);

  return (
    <AppShell>
      <div className="mb-4">
        <WhaleStrip />
      </div>
      <h1 className="flex items-center gap-2 text-xl font-bold lg:text-2xl">
        <Compass className="size-5 text-primary" /> Discover
      </h1>
      <p className="text-sm text-muted-foreground">
        Live opportunity discovery across {rows.length || "the"} markets, Solana DEX launches and the news wire.
      </p>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <SectionTitle
            title="Trending now"
            subtitle="Highest relative volume vs 30-day average"
            action={<TrendingUp className="size-4 text-primary" />}
          />
          {market.isLoading && !trending.length ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading live tape…
            </div>
          ) : (
            trending.map((a) => <AssetRow key={a.id} asset={a} />)
          )}
        </section>

        <section className="panel p-5">
          <SectionTitle
            title="AI picks"
            subtitle="Highest live AETHRON conviction today"
            action={<Sparkles className="size-4 text-primary" />}
          />
          <div className="space-y-3">
            {aiPicks.map((a) => (
              <Link
                key={a.id}
                to="/asset/$id"
                params={{ id: a.id }}
                className="block rounded-xl border border-border bg-surface-2/40 p-3 transition hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {a.name} <span className="num text-muted-foreground">{a.symbol}</span>
                  </p>
                  <ScoreRing score={a.aiScore} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.thesis}</p>
                <p className="num mt-1 text-[11px] text-muted-foreground">
                  {fmtUsd(a.price)} · {fmtPct(a.change24h)} 24h · risk {a.riskScore} · {a.aiConfidence}% confidence
                </p>
              </Link>
            ))}
            {!aiPicks.length && <p className="py-6 text-center text-xs text-muted-foreground">Scoring markets…</p>}
          </div>
        </section>

        <section className="panel p-5">
          <SectionTitle
            title="New launches"
            subtitle="Freshly listed Solana tokens with organic traction"
            action={<Rocket className="size-4 text-primary" />}
          />
          <div className="divide-y divide-border/60">
            {fresh.map((t) => (
              <div key={t.mint} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {t.name} <span className="num text-[11px] text-muted-foreground">{t.symbol}</span>
                  </p>
                  <p className="num text-[11px] text-muted-foreground">
                    {age(t.createdAt)} · FDV {fmtUsd(t.fdv || t.mcap)} · liq {fmtUsd(t.liquidity)} ·{" "}
                    {fmtNum(t.holders)} holders
                  </p>
                </div>
                <ScoreRing score={t.score} />
              </div>
            ))}
            {!fresh.length && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {desk.isLoading ? "Scanning new Solana listings…" : "No fresh launches passing the quality filter."}
              </p>
            )}
          </div>
        </section>

        <section className="panel p-5">
          <SectionTitle title="Trending metas" subtitle="Where DEX liquidity is rotating right now" />
          <div className="space-y-2">
            {metas.map((m) => (
              <div key={m.slug} className="rounded-xl border border-border bg-surface-2/40 p-3">
                <p className="text-sm font-medium">
                  {m.emoji} {m.name}
                </p>
                <p className="num mt-1 text-[11px] text-muted-foreground">
                  {fmtUsd(m.marketCap)} cap · {fmtUsd(m.volume)} vol · {fmtNum(m.tokenCount)} tokens ·{" "}
                  <span className={m.change24h >= 0 ? "text-bull" : "text-bear"}>{fmtPct(m.change24h)}</span>
                </p>
                {m.description && <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>}
              </div>
            ))}
            {!metas.length && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {desk.isLoading ? "Loading trending metas…" : "Meta feed unavailable right now."}
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="panel mt-5 p-5">
        <SectionTitle
          title="Live news wire"
          subtitle="Market-moving headlines, refreshed continuously"
          action={<Newspaper className="size-4 text-primary" />}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {(news.data ?? []).map((n) => (
            <a
              key={n.id}
              href={n.url}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-xl border border-border bg-surface-2/40 p-3 transition hover:border-primary/40"
            >
              <p className="text-sm leading-snug">{n.title}</p>
              <p className="num mt-1 text-[11px] text-muted-foreground">
                {n.publisher} · {new Date(n.publishedAt).toLocaleString()}
              </p>
            </a>
          ))}
          {!news.data?.length && (
            <p className="py-4 text-xs text-muted-foreground">
              {news.isLoading ? "Loading the wire…" : "No headlines available right now."}
            </p>
          )}
        </div>
      </section>

      <section className="panel mt-5 p-5">
        <SectionTitle
          title="Learn"
          subtitle="Investing education from beginner to advanced"
          action={<GraduationCap className="size-4 text-primary" />}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {education.map((e) => (
            <article key={e.title} className="rounded-xl border border-border bg-surface-2/40 p-4">
              <span className="rounded-md bg-primary/12 px-2 py-0.5 text-[10px] text-primary">{e.level}</span>
              <p className="mt-2 text-sm leading-snug">{e.title}</p>
              <p className="num mt-1 text-[11px] text-muted-foreground">{e.mins} min read</p>
            </article>
          ))}
        </div>
        <Button asChild variant="subtle" size="sm" className="mt-3">
          <Link to="/assistant">Ask the AI assistant anything</Link>
        </Button>
      </section>
    </AppShell>
  );
}
