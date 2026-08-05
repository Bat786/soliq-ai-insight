import { createFileRoute } from "@tanstack/react-router";
import { Radar, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/soliq/AppShell";
import { AssetPill, Delta, RiskBar, ScoreRing, Sparkline } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { assets, type Category, fmtUsd } from "@/lib/market-data";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "Market Scanner — SOLIQ" },
      {
        name: "description",
        content:
          "Scan crypto, memecoins, DeFi and NFT markets with SOLIQ filters for market cap, volume, price action, technical indicators and risk.",
      },
      { property: "og:title", content: "Market Scanner — SOLIQ" },
      {
        property: "og:description",
        content: "Customisable AI market scanner with SOLIQ Score, risk ratings and trend signals.",
      },
    ],
  }),
  component: Scanner,
});

const categories: { id: Category | "all"; label: string }[] = [
  { id: "all", label: "All markets" },
  { id: "crypto", label: "Crypto" },
  { id: "memecoin", label: "Memecoins" },
  { id: "defi", label: "DeFi" },
  { id: "nft", label: "NFT" },
];

const caps = ["all", "micro", "small", "mid", "large"] as const;
const signals = ["Breakouts", "New highs", "Volume spike", "Momentum", "Oversold RSI"] as const;

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border bg-surface-2/50 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Scanner() {
  const [cat, setCat] = useState<Category | "all">("all");
  const [cap, setCap] = useState<(typeof caps)[number]>("all");
  const [signal, setSignal] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(50);
  const [maxRisk, setMaxRisk] = useState(100);
  const [sort, setSort] = useState<"score" | "change" | "volume">("score");

  const results = useMemo(() => {
    let out = assets.filter(
      (a) =>
        (cat === "all" || a.category === cat) &&
        (cap === "all" || a.cap === cap) &&
        a.score >= minScore &&
        a.risk <= maxRisk,
    );
    if (signal === "Breakouts") out = out.filter((a) => a.change7d > 8);
    if (signal === "New highs") out = out.filter((a) => a.change7d > 12);
    if (signal === "Volume spike") out = out.filter((a) => a.volume24h / a.marketCap > 0.15);
    if (signal === "Momentum") out = out.filter((a) => a.rsi > 60);
    if (signal === "Oversold RSI") out = out.filter((a) => a.rsi < 45);
    return [...out].sort((a, b) =>
      sort === "score" ? b.score - a.score : sort === "change" ? b.change24h - a.change24h : b.volume24h - a.volume24h,
    );
  }, [cat, cap, signal, minScore, maxRisk, sort]);

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold lg:text-2xl">
            <Radar className="size-5 text-primary" /> Market Scanner
          </h1>
          <p className="text-sm text-muted-foreground">
            {results.length} matches · scanning 14,284 assets · refreshed 12s ago
          </p>
        </div>
        <div className="flex gap-2">
          {(["score", "change", "volume"] as const).map((s) => (
            <Chip key={s} active={sort === s} onClick={() => setSort(s)}>
              Sort: {s}
            </Chip>
          ))}
        </div>
      </header>

      <section className="panel mt-4 p-4">
        <p className="mb-2 flex items-center gap-2 text-xs tracking-wide text-muted-foreground uppercase">
          <SlidersHorizontal className="size-3.5" /> Filters
        </p>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {caps.map((c) => (
              <Chip key={c} active={cap === c} onClick={() => setCap(c)}>
                {c === "all" ? "Any cap" : `${c} cap`}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {signals.map((s) => (
              <Chip key={s} active={signal === s} onClick={() => setSignal(signal === s ? null : s)}>
                {s}
              </Chip>
            ))}
          </div>
          <div className="grid gap-4 pt-1 sm:grid-cols-2">
            <label className="block">
              <span className="num text-xs text-muted-foreground">Min SOLIQ Score · {minScore}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--primary)]"
              />
            </label>
            <label className="block">
              <span className="num text-xs text-muted-foreground">Max risk · {maxRisk}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={maxRisk}
                onChange={(e) => setMaxRisk(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--primary)]"
              />
            </label>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {results.map((a) => (
          <article key={a.id} className="panel p-4 transition-transform hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <AssetPill asset={a} />
              <ScoreRing score={a.score} />
            </div>
            <Sparkline data={a.series} up={a.change24h >= 0} className="mt-3 h-12" />
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <p className="text-muted-foreground">Price</p>
                <p className="num text-sm">{fmtUsd(a.price)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">24h vol</p>
                <p className="num text-sm">{fmtUsd(a.volume24h)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">RSI</p>
                <p className="num text-sm">{a.rsi}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <RiskBar risk={a.risk} />
              <Delta value={a.change24h} />
            </div>
            <p className="mt-3 rounded-lg border border-border bg-surface-2/40 p-2.5 text-xs text-muted-foreground">
              <span className="text-primary">Why:</span> {a.reason}
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="subtle" size="sm" className="flex-1">
                Add to list
              </Button>
              <Button variant="hero" size="sm" className="flex-1">
                Analyse
              </Button>
            </div>
          </article>
        ))}
        {results.length === 0 && (
          <p className="panel p-8 text-center text-sm text-muted-foreground lg:col-span-2 xl:col-span-3">
            No assets match this scan. Loosen your filters.
          </p>
        )}
      </div>
    </AppShell>
  );
}
