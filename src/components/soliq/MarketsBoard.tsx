import { useMemo, useState } from "react";
import { Gauge, Globe, Loader2, RadioTower, Search } from "lucide-react";

import { BullBearGauge } from "@/components/soliq/BullBearGauge";
import CandleChart, { type Overlays, type Point, type VolPoint } from "@/components/soliq/CandleChart";
import { Delta, SectionTitle, Sparkline } from "@/components/soliq/primitives";
import { Input } from "@/components/ui/input";
import { useTapeBoard, useTapeDetail, useTapeSearch } from "@/hooks/use-tape";
import type { Bar, Timeframe } from "@/lib/futures.server";
import type { DeskId, Indicators, MarketRow } from "@/lib/tape.server";

const overlays: Overlays = { ma20: true, ma50: true, vwap: true, rsi: true, volume: true, signals: true };

const compact = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B`
  : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K`
  : n.toFixed(0);

const px = (n: number) => (n >= 1000 ? n.toFixed(2) : n >= 10 ? n.toFixed(3) : n.toFixed(5));

const tone = (t: number) => (t > 0.12 ? "text-bull" : t < -0.12 ? "text-bear" : "text-muted-foreground");

function barsToPoints(bars: Bar[]): { points: Point[]; volumes: VolPoint[] } {
  const points: Point[] = [];
  const volumes: VolPoint[] = [];
  for (const b of bars) {
    points.push({ t: b.t, p: b.open }, { t: b.t + 1, p: b.high }, { t: b.t + 2, p: b.low }, { t: b.t + 3, p: b.close });
    volumes.push({ t: b.t, v: b.volume });
  }
  return { points, volumes };
}

function VerdictPill({ ind }: { ind: Indicators }) {
  const cls =
    ind.verdict === "buy" ? "border-bull/50 text-bull"
    : ind.verdict === "sell" ? "border-bear/50 text-bear"
    : "border-border text-muted-foreground";
  return (
    <span className={`num rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase ${cls}`}>
      {ind.verdict} · {ind.score}
    </span>
  );
}

function IndicatorGrid({ ind, last }: { ind: Indicators; last: number }) {
  const cells: { label: string; value: string; cls?: string }[] = [
    { label: "RSI 14", value: ind.rsi14.toFixed(1), cls: ind.rsi14 > 70 ? "text-bear" : ind.rsi14 < 30 ? "text-bull" : "" },
    { label: "MACD hist", value: ind.macdHist.toFixed(5), cls: ind.macdHist >= 0 ? "text-bull" : "text-bear" },
    { label: "VWAP", value: px(ind.vwap), cls: last >= ind.vwap ? "text-bull" : "text-bear" },
    { label: "EMA 20/50", value: `${px(ind.ema20)} / ${px(ind.ema50)}`, cls: ind.ema20 >= ind.ema50 ? "text-bull" : "text-bear" },
    { label: "ATR %", value: `${ind.atrPct.toFixed(2)}%` },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
      {cells.map((c) => (
        <div key={c.label} className="rounded-lg bg-surface-2/50 p-2">
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">{c.label}</p>
          <p className={`num text-[11px] font-medium ${c.cls ?? ""}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function MarketCard({ row, active, onSelect, tf }: { row: MarketRow; active: boolean; onSelect: () => void; tf: Timeframe }) {
  const sig = row.signals.find((s) => s.tf === tf) ?? row.signals[0];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`panel p-4 text-left transition-colors ${active ? "border-primary/60" : "hover:border-primary/30"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="num text-sm font-semibold">{row.code}</p>
          <p className="text-[11px] text-muted-foreground">{row.name}</p>
        </div>
        <div className="text-right">
          {row.status === "syncing" ?
            <p className="text-[10px] text-muted-foreground">syncing…</p>
          : <>
              <p className="num text-sm">{px(row.last)}</p>
              <Delta value={row.changePct} />
            </>
          }
        </div>
      </div>
      {row.spark.length > 2 && (
        <div className="mt-2">
          <Sparkline data={row.spark} up={row.changePct >= 0} className="h-8 w-full" />
        </div>
      )}
      <div className="mt-2">
        <BullBearGauge bull={sig?.bull ?? 50} bear={sig?.bear ?? 50} confidence={sig?.confidence} compact />
      </div>
      <div className="num mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className={tone(sig?.tilt ?? 0)}>{sig?.label ?? "No tape"}</span>
        <VerdictPill ind={row.indicators} />
      </div>
      <div className="num mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>RSI {row.indicators.rsi14.toFixed(0)}</span>
        <span>vol {compact(row.volume)}</span>
        <span>
          {px(row.low)} – {px(row.high)}
        </span>
      </div>
    </button>
  );
}

export type MarketsBoardProps = {
  tf: Timeframe;
  onTf: (t: Timeframe) => void;
  /** Which desks to render. Defaults to the 24/7 forex + crypto grid. */
  decks?: DeskId[];
  defaultKey?: string;
  searchable?: boolean;
  headline?: string;
};

/** Reusable multi-desk terminal: instrument grid + chart + indicator stack. */
export function MarketsBoard({
  tf,
  onTf,
  decks = ["fx", "crypto"],
  defaultKey,
  searchable = false,
  headline,
}: MarketsBoardProps) {
  const [term, setTerm] = useState("");
  const search = useTapeSearch(searchable ? term : "");

  const board = useTapeBoard(decks.length === 1 ? decks[0] : undefined);
  const rows = useMemo(
    () => (board.data?.rows ?? []).filter((r) => decks.includes(r.desk)),
    [board.data, decks.join()],
  );
  const isLoading = board.isLoading;
  const pending = rows.filter((r) => r.status === "syncing").length;

  const [selected, setSelected] = useState(defaultKey ?? "");
  const active = selected || rows[0]?.key || defaultKey || "";
  const detail = useTapeDetail(active, tf);
  const chart = useMemo(() => barsToPoints(detail.data?.bars ?? []), [detail.data?.bars]);

  const groups = useMemo(() => {
    const map = new Map<string, MarketRow[]>();
    for (const r of rows) {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 px-3 py-2 text-[11px]">
        <RadioTower className="size-3.5 text-primary" />
        <span className="text-muted-foreground">Live tape</span>
        <span className="text-foreground">{headline ?? "Forex majors · crosses · crypto"}</span>
        {rows.length > 0 && (
          <span className="num ml-auto text-muted-foreground">
            {rows.length - pending}/{rows.length} instruments live
          </span>
        )}
      </div>

      {searchable && (
        <div className="panel p-3">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search any symbol — NVDA, ES=F, EURUSD=X, BTC-USD…"
              className="h-9"
            />
          </div>
          {search.data && search.data.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {search.data.slice(0, 10).map((h) => (
                <button
                  key={h.symbol}
                  type="button"
                  onClick={() => setSelected(h.symbol)}
                  className="num rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {h.symbol} · {h.name.slice(0, 22)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading && rows.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading live tape…
        </div>
      )}

      {groups.map(([group, list]) => (
        <div key={group} className="space-y-2">
          <SectionTitle title={group} subtitle={`${list.length} instruments · multi-timeframe scoring`} />
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {list.map((r) => (
              <MarketCard key={r.key} row={r} tf={tf} active={active === r.key} onSelect={() => setSelected(r.key)} />
            ))}
          </div>
        </div>
      ))}

      <div className="panel p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <SectionTitle
            title={`${detail.data?.code ?? active} · ${tf} chart`}
            subtitle={detail.data ? `${detail.data.name} · quoted in ${detail.data.quote}` : "Live aggregate tape"}
          />
          {detail.data && (
            <div className="flex items-center gap-3">
              <VerdictPill ind={detail.data.indicators} />
              <div className="text-right">
                <p className="num text-lg font-semibold">{px(detail.data.last)}</p>
                <Delta value={detail.data.changePct} />
              </div>
            </div>
          )}
        </div>

        {detail.isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading {active} bars…
          </div>
        )}
        {detail.isError && (
          <p className="py-16 text-center text-sm text-bear">{(detail.error as Error)?.message ?? "No data for that symbol"}</p>
        )}

        {detail.data && chart.points.length > 4 && (
          <div className="mt-3">
            <CandleChart points={chart.points} volumes={chart.volumes} interval={tf} overlays={overlays} height={400} />
          </div>
        )}

        {detail.data && (
          <>
            <div className="mt-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">
                <Gauge className="size-3 text-primary" /> Indicator stack
              </p>
              <IndicatorGrid ind={detail.data.indicators} last={detail.data.last} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {detail.data.signals.map((s) => (
                <button
                  key={s.tf}
                  type="button"
                  onClick={() => onTf(s.tf)}
                  className={`panel p-3 text-left transition-colors ${tf === s.tf ? "border-primary/60" : "hover:border-primary/30"}`}
                >
                  <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{s.tf} signal</p>
                  <p className={`font-display text-sm font-semibold ${tone(s.tilt)}`}>{s.label}</p>
                  <div className="mt-2">
                    <BullBearGauge bull={s.bull} bear={s.bear} confidence={s.confidence} compact />
                  </div>
                  <p className="num mt-2 text-[10px] text-muted-foreground">
                    chg {s.changePct >= 0 ? "+" : ""}
                    {s.changePct.toFixed(2)}% · vol {compact(s.volume)}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Globe className="mt-0.5 size-3 shrink-0" />
        Every desk streams from a continuous 5-minute aggregate tape with RSI, MACD, VWAP, EMA and volume-weighted
        multi-timeframe scoring.
      </p>
    </div>
  );
}
