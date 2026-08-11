import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, BarChart3, Loader2, Search } from "lucide-react";

import { AppShell } from "@/components/soliq/AppShell";
import { BullBearGauge } from "@/components/soliq/BullBearGauge";
import CandleChart, { type Overlays, type Point, type VolPoint } from "@/components/soliq/CandleChart";
import { MarketsBoard } from "@/components/soliq/MarketsBoard";
import { Delta, SectionTitle, Sparkline } from "@/components/soliq/primitives";
import { WhaleStrip } from "@/components/soliq/WhaleSignal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFuturesBoard, useTickerDetail } from "@/hooks/use-futures";
import type { Bar, Timeframe, TfSignal } from "@/lib/futures.server";


export const Route = createFileRoute("/futures")({
  head: () => ({
    meta: [
      { title: "Futures Desk — live ES, NQ, gold, oil & bitcoin signals | SOLIQ" },
      {
        name: "description",
        content:
          "Live futures and benchmark tape: S&P 500, Nasdaq, crude oil, gold, silver, copper and bitcoin with 1m/5m/15m/1h bullish-bearish signal gauges, volume and charts.",
      },
      { property: "og:title", content: "SOLIQ Futures Desk" },
      {
        property: "og:description",
        content: "Multi-timeframe futures sentiment, volume and charting across index, energy, metals and crypto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FuturesPage,
});

const TFS: { id: Timeframe; label: string }[] = [
  { id: "1m", label: "1m" },
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "1h", label: "1H" },
];

const overlays: Overlays = { ma20: true, ma50: false, vwap: true, rsi: true, volume: true, signals: true };

const compact = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B`
  : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K`
  : n.toFixed(0);

const tone = (t: number) => (t > 0.12 ? "text-bull" : t < -0.12 ? "text-bear" : "text-muted-foreground");

/** Expand OHLC bars into an intra-bucket point series so the chart keeps true OHLC. */
function barsToPoints(bars: Bar[]): { points: Point[]; volumes: VolPoint[] } {
  const points: Point[] = [];
  const volumes: VolPoint[] = [];
  for (const b of bars) {
    points.push({ t: b.t, p: b.open }, { t: b.t + 1, p: b.high }, { t: b.t + 2, p: b.low }, { t: b.t + 3, p: b.close });
    volumes.push({ t: b.t, v: b.volume });
  }
  return { points, volumes };
}

function SignalChip({ s }: { s: TfSignal }) {
  return (
    <div className="rounded-lg bg-surface-2/50 p-2">
      <p className="text-[9px] tracking-wide text-muted-foreground uppercase">{s.tf}</p>
      <p className={`num text-[11px] font-medium ${tone(s.tilt)}`}>{s.bull}% bull</p>
      <p className="num text-[9px] text-muted-foreground">
        {s.changePct >= 0 ? "+" : ""}
        {s.changePct.toFixed(2)}%
      </p>
    </div>
  );
}

function TfSignalRow({ signals, active, onSelect }: { signals: TfSignal[]; active: Timeframe; onSelect: (t: Timeframe) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {signals.map((s) => (
        <button
          key={s.tf}
          type="button"
          onClick={() => onSelect(s.tf)}
          className={`panel p-3 text-left transition-colors ${active === s.tf ? "border-primary/60" : "hover:border-primary/30"}`}
        >
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{s.tf} signal</p>
          <p className={`font-display text-sm font-semibold ${tone(s.tilt)}`}>{s.label}</p>
          <div className="mt-2">
            <BullBearGauge bull={s.bull} bear={s.bear} confidence={s.confidence} compact />
          </div>
          <div className="num mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>
              chg {s.changePct >= 0 ? "+" : ""}
              {s.changePct.toFixed(2)}%
            </span>
            <span>vol {compact(s.volume)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function FuturesPage() {
  const { data, isLoading, isError, error } = useFuturesBoard();
  const [tf, setTf] = useState<Timeframe>("5m");
  const [tab, setTab] = useState<"board" | "fx" | "search">("board");
  const [selected, setSelected] = useState("SPY");
  const [query, setQuery] = useState("");
  const [symbol, setSymbol] = useState("SPY");

  const detailSymbol = tab === "search" ? symbol : selected;
  const detail = useTickerDetail(detailSymbol, tf);
  const chart = useMemo(() => barsToPoints(detail.data?.bars ?? []), [detail.data?.bars]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof data extends undefined ? never : NonNullable<typeof data>["quotes"]>();
    for (const q of data?.quotes ?? []) {
      const list = map.get(q.contract.group) ?? [];
      list.push(q);
      map.set(q.contract.group, list);
    }
    return [...map.entries()];
  }, [data]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Activity className="size-5 text-primary" /> Markets Desk
            </h1>
            <p className="text-sm text-muted-foreground">
              Index, energy, metals, crypto and 24/7 forex tape with multi-timeframe bull/bear gauges, RSI, MACD, VWAP and
              volume analytics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="panel flex gap-1 p-1">
              {(["board", "fx", "search"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-md px-3 py-1.5 text-xs ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t === "board" ? "Contracts"
                  : t === "fx" ? "Forex & crypto 24/7"
                  : "Ticker search"}
                </button>
              ))}
            </div>

            <div className="panel flex gap-1 p-1">
              {TFS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTf(t.id)}
                  className={`num rounded-md px-2.5 py-1.5 text-xs ${tf === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <WhaleStrip />

        {tab === "search" && (
          <form
            className="panel flex flex-wrap items-center gap-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const next = query.trim().toUpperCase();
              if (next) setSymbol(next);
            }}
          >
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any ticker, futures proxy, ETF or stock — SPY, QQQ, GLD, SLV, USO, CPER, IBIT, NVDA"
              className="h-9 min-w-64 flex-1 text-xs"
            />
            <Button type="submit" size="sm" className="h-9">
              Load
            </Button>
            <div className="flex flex-wrap gap-1">
              {["SPY", "QQQ", "IWM", "USO", "GLD", "SLV", "CPER", "IBIT"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setQuery(s);
                    setSymbol(s);
                  }}
                  className={`num rounded-full border px-2 py-0.5 text-[10px] ${symbol === s ? "border-primary/60 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </form>
        )}

        {tab === "board" && (
          <>
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading futures tape…
              </div>
            )}
            {isError && (
              <p className="py-16 text-center text-sm text-bear">
                {(error as Error)?.message ?? "Futures feed unavailable"}
              </p>
            )}
            {groups.map(([group, quotes]) => (
              <div key={group} className="space-y-2">
                <SectionTitle title={group} subtitle="Continuous contract tracked via its most liquid listed proxy" />
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {quotes.map((q) => {
                    const sig = q.signals.find((s) => s.tf === tf) ?? q.signals[0];
                    const active = selected === q.contract.proxy;
                    return (
                      <button
                        key={q.contract.code}
                        type="button"
                        onClick={() => setSelected(q.contract.proxy)}
                        className={`panel p-4 text-left transition-colors ${active ? "border-primary/60" : "hover:border-primary/30"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="num text-sm font-semibold">
                              {q.contract.code}
                              <span className="ml-1.5 text-[10px] text-muted-foreground">{q.contract.proxy}</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">{q.contract.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="num text-sm">${q.last.toFixed(2)}</p>
                            <Delta value={q.changePct} />
                          </div>
                        </div>
                        {q.spark.length > 2 && (
                          <div className="mt-2">
                            <Sparkline data={q.spark} up={q.changePct >= 0} className="h-8 w-full" />
                          </div>
                        )}
                        <div className="mt-2">
                          <BullBearGauge
                            bull={sig?.bull ?? 50}
                            bear={sig?.bear ?? 50}
                            confidence={sig?.confidence}
                            whaleBull={Math.round((q.optionsTilt + 1) * 50)}
                            compact
                          />
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-1.5">
                          {q.signals.map((s) => (
                            <SignalChip key={s.tf} s={s} />
                          ))}
                        </div>
                        <div className="num mt-2 flex justify-between text-[10px] text-muted-foreground">
                          <span>vol {compact(q.totalVolume)}</span>
                          <span>
                            H {q.high.toFixed(2)} · L {q.low.toFixed(2)}
                          </span>
                          <span>{q.marketTime}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        <div className="panel p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <SectionTitle
              title={`${detailSymbol} · ${tf} chart`}
              subtitle={detail.data ? `${detail.data.fullName} · ${detail.data.issueType}` : "Live Unusual Whales OHLC tape"}
            />
            {detail.data && (
              <div className="text-right">
                <p className="num text-lg font-semibold">${detail.data.last.toFixed(2)}</p>
                <Delta value={detail.data.changePct} />
              </div>
            )}
          </div>

          {detail.isLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading {detailSymbol} bars…
            </div>
          )}
          {detail.isError && (
            <p className="py-16 text-center text-sm text-bear">
              {(detail.error as Error)?.message ?? "No data for that symbol"}
            </p>
          )}

          {detail.data && chart.points.length > 4 && (
            <div className="mt-3">
              <CandleChart points={chart.points} volumes={chart.volumes} interval={tf} overlays={overlays} height={420} />
            </div>
          )}

          {detail.data && (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <div className="panel p-3">
                  <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Session volume</p>
                  <p className="num mt-1 text-sm">{compact(detail.data.totalVolume)}</p>
                </div>
                <div className="panel p-3">
                  <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Day range</p>
                  <p className="num mt-1 text-sm">
                    {detail.data.low.toFixed(2)} – {detail.data.high.toFixed(2)}
                  </p>
                </div>
                <div className="panel p-3">
                  <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Option call / put vol</p>
                  <p className="num mt-1 text-sm">
                    {compact(detail.data.callVolume)} / {compact(detail.data.putVolume)}
                  </p>
                </div>
                <div className="panel p-3">
                  <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Net option premium</p>
                  <p className={`num mt-1 text-sm ${detail.data.netOptionPremium >= 0 ? "text-bull" : "text-bear"}`}>
                    ${compact(Math.abs(detail.data.netOptionPremium))}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">
                  <BarChart3 className="size-3 text-primary" /> Multi-timeframe sentiment
                </p>
                <TfSignalRow signals={detail.data.signals} active={tf} onSelect={setTf} />
              </div>
            </>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Futures exposure is tracked through the most liquid listed proxy for each contract (ES→SPY, NQ→QQQ, CL→USO,
          GC→GLD, SI→SLV, HG→CPER, BTC→IBIT) using live Unusual Whales price, volume and options tape. Informational
          only — not financial advice.
        </p>
      </div>
    </AppShell>
  );
}
