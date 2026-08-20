import { useMemo, useState } from "react";
import { History, Loader2 } from "lucide-react";

import { SectionTitle } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { useStablecoinHistory } from "@/hooks/use-stablecoins";
import type { PegHistoryRow } from "@/lib/stablecoin-history.server";

const WINDOWS = [30, 90, 180, 365] as const;

/** Signed deviation chart: 0 bps is the peg line, the band is ±50 bps. */
function DeviationChart({ row }: { row: PegHistoryRow }) {
  const { path, area, scale } = useMemo(() => {
    const pts = row.points;
    const peak = Math.max(50, ...pts.map((p) => Math.abs(p.bps)));
    const x = (i: number) => (pts.length < 2 ? 0 : (i / (pts.length - 1)) * 100);
    const y = (b: number) => 20 - (b / peak) * 18;
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.bps).toFixed(2)}`).join(" ");
    return {
      path: d,
      area: pts.length > 1 ? `${d} L100,20 L0,20 Z` : "",
      scale: peak,
    };
  }, [row.points]);

  const broke = Math.abs(row.stats.worstBps) > 150;

  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
      {/* ±50 bps tolerance band */}
      <rect
        x="0"
        y={20 - (50 / scale) * 18}
        width="100"
        height={(100 / scale) * 18}
        className="fill-bull/10"
      />
      <line x1="0" y1="20" x2="100" y2="20" className="stroke-border" strokeWidth="0.3" />
      {area && <path d={area} className={broke ? "fill-bear/15" : "fill-primary/15"} />}
      <path
        d={path}
        fill="none"
        strokeWidth="0.8"
        vectorEffect="non-scaling-stroke"
        className={broke ? "stroke-bear" : "stroke-primary"}
      />
    </svg>
  );
}

function HistoryCard({ row }: { row: PegHistoryRow }) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="num text-sm font-semibold">{row.symbol}</p>
          <p className="num text-[10px] text-muted-foreground">{row.ticker} · {row.stats.days}d of flat files</p>
        </div>
        <span
          className={`num rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase ${
            row.stats.uptimePct >= 99
              ? "border-bull/50 text-bull"
              : row.stats.uptimePct >= 95
                ? "border-primary/50 text-primary"
                : "border-bear/50 text-bear"
          }`}
        >
          {row.stats.uptimePct.toFixed(1)}% in band
        </span>
      </div>

      <div className="mt-2">
        <DeviationChart row={row} />
      </div>

      <div className="num mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
        <div className="rounded-lg bg-surface-2/50 p-2">
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Avg drift</p>
          <p>{row.stats.avgAbsBps.toFixed(1)} bps</p>
        </div>
        <div className="rounded-lg bg-surface-2/50 p-2">
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Worst</p>
          <p className={Math.abs(row.stats.worstBps) > 150 ? "text-bear" : ""}>
            {row.stats.worstBps >= 0 ? "+" : ""}
            {row.stats.worstBps.toFixed(0)} bps
          </p>
        </div>
        <div className="rounded-lg bg-surface-2/50 p-2">
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Days off peg</p>
          <p>{row.stats.daysOffPeg}</p>
        </div>
      </div>

      {row.stats.worstDate && (
        <p className="num mt-1.5 text-[10px] text-muted-foreground">worst session {row.stats.worstDate}</p>
      )}
    </div>
  );
}

/**
 * Long-range peg stability from Massive flat files (daily S3 exports, not the
 * live REST tape) — the backtest view for how well each peg has held.
 */
export function PegHistoryPanel() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, isError, error } = useStablecoinHistory(days);

  return (
    <div className="space-y-2">
      <SectionTitle
        title="Peg stability backtest"
        subtitle="End-of-day history from Massive flat files — deviation from peg in basis points, ±50 bps band shaded"
      />

      <div className="panel flex flex-wrap items-center gap-3 px-3 py-2 text-[11px]">
        <History className="size-3.5 text-primary" />
        <span className="text-muted-foreground">Window</span>
        <span className="num text-foreground">
          {data?.from && data?.to ? `${data.from} → ${data.to}` : "—"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {WINDOWS.map((w) => (
            <Button
              key={w}
              size="sm"
              variant={days === w ? "subtle" : "ghost"}
              onClick={() => setDays(w)}
              className="h-7 px-2 text-[11px]"
            >
              {w}D
            </Button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Pulling {days} daily flat files…
        </div>
      )}
      {isError && (
        <p className="py-10 text-center text-sm text-bear">
          {(error as Error)?.message ?? "Historical peg data unavailable"}
        </p>
      )}

      {data && data.rows.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {data.rows.map((r) => (
            <HistoryCard key={r.symbol} row={r} />
          ))}
        </div>
      )}

      {data && data.notes.length > 0 && (
        <p className="num text-[10px] text-muted-foreground">{data.notes.join(" · ")}</p>
      )}
    </div>
  );
}
