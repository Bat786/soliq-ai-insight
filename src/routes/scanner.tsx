import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Loader2, Radar, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { WhaleStrip } from "@/components/soliq/WhaleSignal";
import { AppShell } from "@/components/soliq/AppShell";
import { CommandBar } from "@/components/soliq/CommandBar";
import { MarketsBoard } from "@/components/soliq/MarketsBoard";
import type { Timeframe } from "@/lib/futures.server";
import type { DeskId } from "@/lib/tape.server";
import { Delta, RiskBar, ScoreRing, Sparkline } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarket } from "@/hooks/use-market";
import {
  applyFilters,
  capLabels,
  emptyFilters,
  fmtPctc,
  fmtUsdc,
  presets,
  type CapBucket,
  type LiveAsset,
  type ScanFilters,
  type Sector,
  sectorLabels,
  signalLabels,
  type SortKey,
} from "@/lib/market-types";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "AI Universal Market Scanner — SOLIQ" },
      {
        name: "description",
        content:
          "Scan 200+ live crypto, DeFi, AI and memecoin markets with SOLIQ filters for market cap, relative volume, RSI, whale flow, sentiment and AI conviction.",
      },
      { property: "og:title", content: "AI Universal Market Scanner — SOLIQ" },
      { property: "og:description", content: "Live multi-market scanner with AI conviction scores and natural-language commands." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Scanner,
});

const sortOptions: { id: SortKey; label: string }[] = [
  { id: "aiScore", label: "AI Score" },
  { id: "change24h", label: "24h %" },
  { id: "change7d", label: "7d %" },
  { id: "relVolume", label: "Rel Volume" },
  { id: "volume24h", label: "Volume" },
  { id: "marketCap", label: "Market Cap" },
  { id: "rsi", label: "RSI" },
  { id: "riskScore", label: "Risk" },
  { id: "social", label: "Social" },
];

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</span>
      <Input
        inputMode="decimal"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange(raw === "" ? null : Number(raw));
        }}
        className="mt-1 h-8 text-xs"
        placeholder="any"
      />
    </label>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
        active ? "border-primary/60 bg-primary/15 text-foreground" : "border-border/70 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="num text-xs font-medium">{value}</p>
    </div>
  );
}

function ResultRow({ asset }: { asset: LiveAsset }) {
  const [open, setOpen] = useState(false);
  const o = asset.onchain;
  return (
    <div className="border-b border-border/60 last:border-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 py-2.5 text-left">
        <img src={asset.image} alt={`${asset.name} logo`} loading="lazy" className="size-7 rounded-full bg-surface-2" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {asset.name} <span className="num text-[11px] text-muted-foreground">{asset.symbol}</span>
          </p>
          <p className="num text-[11px] text-muted-foreground">
            {fmtUsdc(asset.marketCap)} · {capLabels[asset.cap]} · {sectorLabels[asset.sector]}
          </p>
        </div>
        <div className="hidden w-20 shrink-0 md:block">
          <Sparkline data={asset.series} up={asset.change24h >= 0} />
        </div>
        <div className="hidden w-24 shrink-0 text-right lg:block">
          <p className="num text-[11px] text-muted-foreground">rel vol</p>
          <p className="num text-xs">{asset.relVolume}x</p>
        </div>
        <div className="hidden w-28 shrink-0 lg:block">
          <RiskBar risk={asset.riskScore} />
        </div>
        <div className="w-16 shrink-0 text-right">
          <ScoreRing score={asset.aiScore} />
        </div>
        <div className="w-24 shrink-0 text-right">
          <p className="num text-sm">{fmtUsdc(asset.price)}</p>
          <Delta value={asset.change24h} />
        </div>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="grid gap-3 rounded-xl bg-surface-2/40 p-3 pb-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-xs text-muted-foreground">
              <span
                className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  asset.stance === "bullish" ? "bg-bull/15 text-bull" : asset.stance === "bearish" ? "bg-bear/15 text-bear" : "bg-muted text-muted-foreground"
                }`}
              >
                {asset.stance} · {asset.aiConfidence}% confidence
              </span>
              {asset.thesis}
            </p>
          </div>
          <Metric label="Bull / Bear" value={`${asset.bullScore} / ${asset.bearScore}`} />
          <Metric label="Buy pressure" value={`${asset.buyPressure}% vs ${asset.sellPressure}%`} />
          <Metric label="RSI · ADX" value={`${asset.indicators.rsi} · ${asset.indicators.adx}`} />
          <Metric label="Volatility" value={`${asset.indicators.volatility}%`} />
          <Metric label="Liquidity" value={fmtUsdc(o.liquidity)} />
          <Metric label="Holders" value={o.holders.toLocaleString()} />
          <Metric label="Whale accumulation" value={`${o.whaleAccumulation}/100`} />
          <Metric label="Smart money" value={`${o.smartMoney}/100`} />
          <Metric label="Top wallet conc." value={`${o.topWalletConcentration}%`} />
          <Metric label="DEX / CEX volume" value={`${fmtUsdc(o.dexVolume)} / ${fmtUsdc(o.cexVolume)}`} />
          <Metric label="Social sentiment" value={`${asset.sentiment.social}/100`} />
          <Metric label="News sentiment" value={`${asset.sentiment.news}/100`} />
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-1.5">
            {(Object.keys(signalLabels) as (keyof typeof signalLabels)[])
              .filter((k) => asset.signals[k])
              .map((k) => (
                <span key={k} className="rounded-md bg-primary/12 px-1.5 py-0.5 text-[10px] text-primary">
                  {signalLabels[k]}
                </span>
              ))}
            <Button asChild size="sm" variant="subtle" className="ml-auto">
              <Link to="/asset/$id" params={{ id: asset.id }}>
                Open full analysis
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Scanner() {
  const { data, isLoading, isError, error } = useMarket();
  const [filters, setFilters] = useState<ScanFilters>(emptyFilters);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [desk, setDesk] = useState<DeskId>("stocks");
  const [tf, setTf] = useState<Timeframe>("5m");

  const set = <K extends keyof ScanFilters>(key: K, value: ScanFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const rows = useMemo(() => (data ? applyFilters(data.rows, filters) : []), [data, filters]);

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setActivePreset(id);
    setAiSummary(p.blurb);
    setFilters({ ...emptyFilters, ...p.filters });
  };

  return (
    <AppShell>
      <div className="mb-4"><WhaleStrip /></div>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">AI Universal Market Scanner</h1>
            <p className="text-sm text-muted-foreground">
              Live prices, indicators and AI conviction across {data?.rows.length ?? 0} markets.
              {data?.global && ` Global cap ${fmtUsdc(data.global.marketCap)} (${fmtPctc(data.global.change24h)}).`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="subtle" size="sm" onClick={() => setShowFilters((v) => !v)}>
              <Radar className="size-4" /> {showFilters ? "Hide filters" : "Filters"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(emptyFilters);
                setActivePreset(null);
                setAiSummary(null);
              }}
            >
              <RotateCcw className="size-4" /> Reset
            </Button>
          </div>
        </div>

        <CommandBar
          onResult={(f, name, summary) => {
            setFilters({ ...emptyFilters, ...f });
            setActivePreset(null);
            setAiSummary(`${name} — ${summary}`);
          }}
        />

        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Chip key={p.id} active={activePreset === p.id} onClick={() => applyPreset(p.id)}>
              {p.name}
            </Chip>
          ))}
        </div>

        {showFilters && (
          <div className="panel space-y-4 p-4">
            <div>
              <p className="mb-2 text-[10px] tracking-wide text-muted-foreground uppercase">Sector</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(sectorLabels) as Sector[]).map((s) => (
                  <Chip key={s} active={filters.sectors.includes(s)} onClick={() => set("sectors", toggle(filters.sectors, s))}>
                    {sectorLabels[s]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] tracking-wide text-muted-foreground uppercase">Market cap tier</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(capLabels) as CapBucket[]).map((c) => (
                  <Chip key={c} active={filters.caps.includes(c)} onClick={() => set("caps", toggle(filters.caps, c))}>
                    {capLabels[c]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] tracking-wide text-muted-foreground uppercase">Signals</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(signalLabels) as (keyof typeof signalLabels)[]).map((s) => (
                  <Chip
                    key={s}
                    active={filters.requireSignals.includes(s)}
                    onClick={() => set("requireSignals", toggle(filters.requireSignals, s))}
                  >
                    {signalLabels[s]}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Num label="Min price" value={filters.minPrice} onChange={(v) => set("minPrice", v)} />
              <Num label="Max price" value={filters.maxPrice} onChange={(v) => set("maxPrice", v)} />
              <Num label="Min mkt cap" value={filters.minMarketCap} onChange={(v) => set("minMarketCap", v)} />
              <Num label="Max mkt cap" value={filters.maxMarketCap} onChange={(v) => set("maxMarketCap", v)} />
              <Num label="Min volume" value={filters.minVolume} onChange={(v) => set("minVolume", v)} />
              <Num label="Min rel vol" value={filters.minRelVolume} onChange={(v) => set("minRelVolume", v)} />
              <Num label="Min liquidity" value={filters.minLiquidity} onChange={(v) => set("minLiquidity", v)} />
              <Num label="Min 1h %" value={filters.minChange1h} onChange={(v) => set("minChange1h", v)} />
              <Num label="Min 24h %" value={filters.minChange24h} onChange={(v) => set("minChange24h", v)} />
              <Num label="Max 24h %" value={filters.maxChange24h} onChange={(v) => set("maxChange24h", v)} />
              <Num label="Min 7d %" value={filters.minChange7d} onChange={(v) => set("minChange7d", v)} />
              <Num label="RSI min" value={filters.rsiMin} onChange={(v) => set("rsiMin", v)} />
              <Num label="RSI max" value={filters.rsiMax} onChange={(v) => set("rsiMax", v)} />
              <Num label="Min ADX" value={filters.minAdx} onChange={(v) => set("minAdx", v)} />
              <Num label="Min AI score" value={filters.minAiScore} onChange={(v) => set("minAiScore", v)} />
              <Num label="Min confidence" value={filters.minConfidence} onChange={(v) => set("minConfidence", v)} />
              <Num label="Max risk" value={filters.maxRisk} onChange={(v) => set("maxRisk", v)} />
              <Num label="Min social" value={filters.minSocial} onChange={(v) => set("minSocial", v)} />
              <Num label="Min news" value={filters.minNews} onChange={(v) => set("minNews", v)} />
              <Num label="Min buy pressure" value={filters.minBuyPressure} onChange={(v) => set("minBuyPressure", v)} />
              <Num label="Min whale accum" value={filters.minWhaleAccumulation} onChange={(v) => set("minWhaleAccumulation", v)} />
              <Num label="Min smart money" value={filters.minSmartMoney} onChange={(v) => set("minSmartMoney", v)} />
              <Num label="Min holder growth" value={filters.minHolderGrowth} onChange={(v) => set("minHolderGrowth", v)} />
              <Num label="Max wallet conc." value={filters.maxConcentration} onChange={(v) => set("maxConcentration", v)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] tracking-wide text-muted-foreground uppercase">Combine with</span>
              <Chip active={filters.logic === "and"} onClick={() => set("logic", "and")}>
                AND
              </Chip>
              <Chip active={filters.logic === "or"} onClick={() => set("logic", "or")}>
                OR
              </Chip>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Search ticker or name"
            className="h-9 max-w-56"
          />
          {sortOptions.map((s) => (
            <Chip
              key={s.id}
              active={filters.sort === s.id}
              onClick={() => (filters.sort === s.id ? set("desc", !filters.desc) : set("sort", s.id))}
            >
              {s.label}
              {filters.sort === s.id ? (filters.desc ? " ↓" : " ↑") : ""}
            </Chip>
          ))}
        </div>

        {aiSummary && <p className="text-xs text-primary">{aiSummary}</p>}

        <div className="panel p-3">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading live markets…
            </div>
          ) : isError ? (
            <p className="py-12 text-center text-sm text-bear">{(error as Error).message}</p>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No markets match this scan. Loosen a filter.</p>
          ) : (
            <>
              <p className="mb-1 text-[11px] text-muted-foreground">{rows.length} matches</p>
              {rows.slice(0, 80).map((a) => (
                <ResultRow key={a.id} asset={a} />
              ))}
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Prices, volume and indicators are live. Liquidity, holder, whale-flow and sentiment metrics are modelled from live
          market behaviour and clearly labelled as such — not exchange-verified on-chain feeds.
        </p>

        <section className="pt-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">Cross-asset scanner</h2>
              <p className="text-sm text-muted-foreground">
                Same indicator engine across stocks, futures, forex and benchmarks — RSI, MACD, VWAP, EMA and 1m→1h
                conviction.
              </p>
            </div>
            <div className="scroll-none flex gap-2 overflow-x-auto">
              {crossDesks.map((d) => (
                <Chip key={d.id} active={desk === d.id} onClick={() => setDesk(d.id)}>
                  {d.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <MarketsBoard key={desk} tf={tf} onTf={setTf} decks={[desk]} headline={crossHeadline(desk)} searchable />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

const crossDesks = [
  { id: "stocks", label: "Stocks" },
  { id: "futures", label: "Futures" },
  { id: "fx", label: "Forex 24/7" },
  { id: "indices", label: "Benchmarks" },
  { id: "crypto", label: "Crypto majors" },
] as const;

function crossHeadline(id: DeskId) {
  return crossDesks.find((d) => d.id === id)?.label ?? "Live tape";
}
