import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import type { Overlays, RawBar } from "@/components/soliq/CandleChart";
import type { DeskTf } from "@/lib/timeframes";

const CandleChart = lazy(() => import("@/components/soliq/CandleChart"));

const overlayMeta = [
  { key: "ma20", label: "MA20" },
  { key: "ma50", label: "MA50" },
  { key: "vwap", label: "VWAP" },
  { key: "rsi", label: "RSI" },
  { key: "volume", label: "Volume" },
  { key: "signals", label: "Signals" },
] as const;

/** Provider-native OHLCV chart with indicator overlays for one symbol. */
export function SymbolChart({ bars, timeframe }: { bars: RawBar[]; timeframe: DeskTf }) {
  const [overlays, setOverlays] = useState<Overlays>({
    ma20: true,
    ma50: true,
    vwap: true,
    rsi: true,
    volume: true,
    signals: true,
  });

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap gap-1.5 border-b border-border/70 px-4 py-2">
        {overlayMeta.map(({ key, label }) => (
          <Toggle
            key={key}
            size="sm"
            pressed={overlays[key]}
            onPressedChange={(v) => setOverlays((o) => ({ ...o, [key]: v }))}
            className="h-7 px-2 text-[11px] data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
          >
            {label}
          </Toggle>
        ))}
        <span className="ml-auto self-center text-[10px] text-muted-foreground">
          {bars.length} {timeframe} bars · drag to pan · scroll to zoom
        </span>
      </div>
      <div className="px-2 py-2">
        {bars.length === 0 ? (
          <Skeleton className="h-[440px] w-full" />
        ) : (
          <ClientOnly fallback={<Skeleton className="h-[440px] w-full" />}>
            <Suspense fallback={<Skeleton className="h-[440px] w-full" />}>
              <CandleChart bars={bars} interval={timeframe} overlays={overlays} height={440} />
            </Suspense>
          </ClientOnly>
        )}
      </div>
    </div>
  );
}
