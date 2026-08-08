import { ClientOnly } from "@tanstack/react-router";
import { Activity, BarChart3, Crosshair, LineChart, Sigma } from "lucide-react";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";

import { useTheme } from "@/components/soliq/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { fmtUsdc } from "@/lib/market-types";
import type { Candle, IntervalId, Overlays, Point, VolPoint } from "@/components/soliq/CandleChart";

const CandleChart = lazy(() => import("@/components/soliq/CandleChart"));

export const chartRanges = [
  { label: "1D", days: 1, intervals: ["1m", "5m", "15m", "1h"] },
  { label: "1W", days: 7, intervals: ["15m", "1h", "4h"] },
  { label: "1M", days: 30, intervals: ["1h", "4h", "1d"] },
  { label: "3M", days: 90, intervals: ["4h", "1d"] },
  { label: "1Y", days: 365, intervals: ["1d", "1w"] },
  { label: "5Y", days: 1825, intervals: ["1d", "1w", "1M"] },
] as const;

const overlayMeta = [
  { key: "ma20", label: "MA20", icon: LineChart },
  { key: "ma50", label: "MA50", icon: LineChart },
  { key: "vwap", label: "VWAP", icon: Sigma },
  { key: "rsi", label: "RSI", icon: Activity },
  { key: "volume", label: "Volume", icon: BarChart3 },
  { key: "signals", label: "Signals", icon: Crosshair },
] as const;

export function ChartTerminal({
  points,
  volumes,
  price,
  symbol,
  days,
  onDaysChange,
  loading = false,
}: {
  points: Point[];
  volumes?: VolPoint[];
  price: number;
  symbol: string;
  days: number;
  onDaysChange: (d: number) => void;
  loading?: boolean;
}) {
  const { formatDate } = useTheme();
  const [overlays, setOverlays] = useState<Overlays>({
    ma20: true,
    ma50: true,
    vwap: true,
    rsi: true,
    volume: true,
    signals: true,
  });
  const range = useMemo(() => chartRanges.find((r) => r.days === days) ?? chartRanges[2], [days]);
  const [interval, setInterval] = useState<IntervalId>(range.intervals[1] ?? "1d");
  const [hover, setHover] = useState<Candle | null>(null);

  const activeInterval = (range.intervals as readonly string[]).includes(interval)
    ? interval
    : ((range.intervals[1] ?? range.intervals[0]) as IntervalId);

  const onHover = useCallback((c: Candle | null) => setHover(c), []);
  const shown = hover;
  const up = shown ? shown.close >= shown.open : true;

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
        <p className="num text-sm font-semibold">
          {symbol} <span className="text-muted-foreground">·</span> {fmtUsdc(shown?.close ?? price)}
        </p>
        {shown && (
          <p className={`num text-[11px] ${up ? "text-bull" : "text-bear"}`}>
            O {fmtUsdc(shown.open)} H {fmtUsdc(shown.high)} L {fmtUsdc(shown.low)} C {fmtUsdc(shown.close)} ·{" "}
            {formatDate((shown.time as unknown as number) * 1000)}
          </p>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {chartRanges.map((r) => (
            <Button
              key={r.days}
              size="sm"
              variant={days === r.days ? "subtle" : "ghost"}
              onClick={() => onDaysChange(r.days)}
              className="h-7 px-2 text-[11px]"
            >
              {r.label}
            </Button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          {range.intervals.map((iv) => (
            <Button
              key={iv}
              size="sm"
              variant={activeInterval === iv ? "subtle" : "ghost"}
              onClick={() => setInterval(iv as IntervalId)}
              className="h-7 px-2 text-[11px]"
            >
              {iv.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border/70 px-4 py-2">
        {overlayMeta.map(({ key, label, icon: Icon }) => (
          <Toggle
            key={key}
            size="sm"
            pressed={overlays[key]}
            onPressedChange={(v) => setOverlays((o) => ({ ...o, [key]: v }))}
            className="h-7 gap-1.5 px-2 text-[11px] data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
          >
            <Icon className="size-3" /> {label}
          </Toggle>
        ))}
        <span className="ml-auto self-center text-[10px] text-muted-foreground">
          Hollow candles · drag to pan · scroll to zoom · hover for live OHLC
        </span>
      </div>

      <div className="px-2 py-2">
        {loading || points.length === 0 ? (
          <Skeleton className="h-[420px] w-full" />
        ) : (
          <ClientOnly fallback={<Skeleton className="h-[420px] w-full" />}>
            <Suspense fallback={<Skeleton className="h-[420px] w-full" />}>
              <CandleChart
                points={points}
                volumes={volumes}
                interval={activeInterval}
                overlays={overlays}
                onHover={onHover}
              />
            </Suspense>
          </ClientOnly>
        )}
      </div>
    </div>
  );
}
