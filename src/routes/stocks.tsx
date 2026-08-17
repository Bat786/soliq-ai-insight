import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/soliq/AppShell";
import { MarketsBoard } from "@/components/soliq/MarketsBoard";
import { StockResearch } from "@/components/soliq/StockResearch";
import { WhaleStrip } from "@/components/soliq/WhaleSignal";
import { Button } from "@/components/ui/button";
import type { Timeframe } from "@/lib/futures.server";

export const Route = createFileRoute("/stocks")({
  head: () => ({
    meta: [
      { title: "Stocks Desk — Megacaps, Semis & Benchmarks | SOLIQ" },
      {
        name: "description",
        content:
          "Live stocks desk: megacap and semiconductor tape, index benchmarks, RSI/MACD/VWAP scoring and multi-timeframe bull-bear signals.",
      },
      { property: "og:title", content: "Stocks Desk — SOLIQ" },
      {
        property: "og:description",
        content: "Megacap and semi tape with indicator stacks, benchmarks and multi-timeframe signals.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://soliqintel.com/stocks" },
      { property: "og:image", content: "https://soliqintel.com/og-soliq.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://soliqintel.com/og-soliq.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://soliqintel.com/stocks" }],
  }),
  component: StocksDesk,
});

const tabs = [
  { id: "equities", label: "Equities", decks: ["stocks"] as const, headline: "Megacaps · semis · crypto equities" },
  { id: "benchmarks", label: "Benchmarks & rates", decks: ["indices"] as const, headline: "S&P · Nasdaq · VIX · 10Y" },
  { id: "search", label: "Symbol search", decks: ["stocks"] as const, headline: "Search any listed ticker" },
  { id: "research", label: "Research & options", decks: ["stocks"] as const, headline: "Fundamentals and options chains" },
];

function StocksDesk() {
  const [tab, setTab] = useState(tabs[0]!.id);
  const [tf, setTf] = useState<Timeframe>("5m");
  const active = tabs.find((t) => t.id === tab)!;

  return (
    <AppShell>
      <div className="mb-4">
        <WhaleStrip />
      </div>
      <h1 className="flex items-center gap-2 text-xl font-bold lg:text-2xl">
        <BarChart3 className="size-5 text-primary" /> Stocks Desk
      </h1>
      <p className="text-sm text-muted-foreground">
        Equity tape with institutional flow overlays, indicator stacks and 1m→1h conviction scoring.
      </p>

      <div className="scroll-none mt-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? "hero" : "subtle"} onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>

      <div className="mt-4">
        {active.id === "research" ? (
          <StockResearch />
        ) : (
        <MarketsBoard
          key={active.id}
          tf={tf}
          onTf={setTf}
          decks={[...active.decks]}
          headline={active.headline}
          searchable={active.id === "search"}
        />
        )}
      </div>
    </AppShell>
  );
}
