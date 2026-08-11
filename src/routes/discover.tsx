import { createFileRoute } from "@tanstack/react-router";
import { Compass, GraduationCap, Rocket, Sparkles, TrendingUp } from "lucide-react";

import { WhaleStrip } from "@/components/soliq/WhaleSignal";
import { AppShell } from "@/components/soliq/AppShell";
import { AssetRow, ScoreRing, SectionTitle } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { aiPicks, education, newProjects, predictions, trending } from "@/lib/market-data";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — Trending, AI Picks & Prediction Markets | SOLIQ" },
      {
        name: "description",
        content:
          "Discover trending assets, AI-selected opportunities, newly launched projects, prediction markets and investing education on SOLIQ.",
      },
      { property: "og:title", content: "Discover — SOLIQ" },
      { property: "og:description", content: "Trending coins, AI picks, new launches, forecasts and education." },
    ],
  }),
  component: Discover,
});

function Discover() {
  return (
    <AppShell>
      <div className="mb-4"><WhaleStrip /></div>
      <h1 className="flex items-center gap-2 text-xl font-bold lg:text-2xl">
        <Compass className="size-5 text-primary" /> Discover
      </h1>
      <p className="text-sm text-muted-foreground">Opportunity discovery engine, refreshed continuously.</p>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <SectionTitle title="Trending now" subtitle="Social momentum + volume" action={<TrendingUp className="size-4 text-primary" />} />
          {trending.map((a) => (
            <AssetRow key={a.id} asset={a} />
          ))}
        </section>

        <section className="panel p-5">
          <SectionTitle title="AI Picks" subtitle="Highest SOLIQ Scores today" action={<Sparkles className="size-4 text-primary" />} />
          <div className="space-y-3">
            {aiPicks.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-surface-2/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {a.name} <span className="num text-muted-foreground">{a.symbol}</span>
                  </p>
                  <ScoreRing score={a.score} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.reason}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <SectionTitle title="New projects" subtitle="Launched in the last 14 days" action={<Rocket className="size-4 text-primary" />} />
          <div className="divide-y divide-border/60">
            {newProjects.map((p) => (
              <div key={p.symbol} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="num text-[11px] text-muted-foreground">
                    {p.symbol} · {p.age} old · FDV {p.fdv}
                  </p>
                </div>
                <ScoreRing score={p.score} />
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <SectionTitle title="Prediction markets" subtitle="Community forecasts" />
          <div className="space-y-3">
            {predictions.map((p) => (
              <div key={p.q} className="rounded-xl border border-border bg-surface-2/40 p-3">
                <p className="text-sm">{p.q}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-bull" style={{ width: `${p.yes}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="num">
                    <span className="text-bull">Yes {p.yes}%</span> · No {100 - p.yes}%
                  </span>
                  <span className="num">
                    {p.volume} · closes {p.closes}
                  </span>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="bull" className="flex-1">
                    Yes
                  </Button>
                  <Button size="sm" variant="bear" className="flex-1">
                    No
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel mt-5 p-5">
        <SectionTitle title="Learn" subtitle="Investing education from beginner to advanced" action={<GraduationCap className="size-4 text-primary" />} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {education.map((e) => (
            <article key={e.title} className="rounded-xl border border-border bg-surface-2/40 p-4">
              <span className="rounded-md bg-primary/12 px-2 py-0.5 text-[10px] text-primary">{e.level}</span>
              <p className="mt-2 text-sm leading-snug">{e.title}</p>
              <p className="num mt-1 text-[11px] text-muted-foreground">{e.mins} min read</p>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
