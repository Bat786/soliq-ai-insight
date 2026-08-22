/**
 * PRISM multi-horizon fan chart. Pure presentation over the existing
 * ProjectionSet — no fetches, no projection math. Horizons are spaced by log
 * time so intraday reads next to 1Y.
 */

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ProjectionSet } from "@/lib/projections";

type Point = {
  horizon: string;
  label: string;
  x: number;
  base: number;
  bull: number;
  bear: number;
  low: number;
  band: [number, number];
  confidence: number;
};

/** Adaptive price formatting: FX crosses need 4-5 digits, indices need 2. */
const fmtPx = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (abs >= 100) return `$${n.toFixed(2)}`;
  if (abs >= 1) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(4)}`;
};

function TipCard({ p }: { p: Point }) {
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 p-2 shadow-lg backdrop-blur">
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{p.label}</p>
      <p className="num mt-1 text-[11px] text-bull">bull {fmtPx(p.bull)}</p>
      <p className="num text-[11px]">base {fmtPx(p.base)}</p>
      <p className="num text-[11px] text-bear">bear {fmtPx(p.bear)}</p>
      <p className="num mt-1 text-[10px] text-muted-foreground">
        range {fmtPx(p.low)}–{fmtPx(p.band[1])} · {p.confidence}% conf
      </p>
    </div>
  );
}

export function ProjectionFanChart({
  projection,
  selected,
  onSelect,
}: {
  projection: ProjectionSet;
  selected: string;
  onSelect: (horizon: string) => void;
}) {
  const spot = projection.current;
  const points: Point[] = [
    {
      horizon: "spot",
      label: "Spot",
      x: 0,
      base: spot,
      bull: spot,
      bear: spot,
      low: spot,
      band: [spot, spot],
      confidence: 0,
    },
    ...projection.horizons.map((h) => ({
      horizon: h.horizon,
      label: h.label,
      // log spacing: minutes-ahead compressed so 15m..1Y all stay readable
      x: Math.log10(1 + h.days * 1440),
      base: h.base.price,
      bull: h.bull.price,
      bear: h.bear.price,
      low: h.low,
      band: [h.low, h.high] as [number, number],
      confidence: h.confidence,
    })),
  ];

  const activeX = points.find((p) => p.horizon === selected)?.x;
  const ticks = points.map((p) => p.x);
  const labelByX = new Map(points.map((p) => [p.x, p.label]));

  const handleClick = (state: unknown) => {
    const idx = (state as { activeTooltipIndex?: number } | null)?.activeTooltipIndex;
    if (typeof idx === "number" && points[idx] && points[idx]!.horizon !== "spot") onSelect(points[idx]!.horizon);
  };

  return (
    <div className="mt-3 rounded-xl bg-surface-2/40 p-2">
      <div className="h-[170px] w-full sm:h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} onClick={handleClick}>
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.25} vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              tickFormatter={(v: number) => labelByX.get(v)?.replace(" min", "m").replace(" hours", "h").replace(" hour", "h").replace(/ (day|days)/, "D").replace(/ (week|weeks)/, "W").replace(/ (month|months)/, "M").replace(/ (year|years)/, "Y") ?? ""}
              tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
              interval={0}
            />
            <YAxis
              domain={["dataMin", "dataMax"]}
              width={58}
              tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
              stroke="var(--border)"
              tickFormatter={(v: number) => fmtPx(v)}
            />
            <Tooltip
              cursor={{ stroke: "var(--primary)", strokeOpacity: 0.4 }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as Point | undefined;
                return p && p.horizon !== "spot" ? <TipCard p={p} /> : null;
              }}
            />
            {activeX !== undefined ? (
              <ReferenceLine x={activeX} stroke="var(--primary)" strokeOpacity={0.5} strokeDasharray="3 3" />
            ) : null}
            <Area
              dataKey="band"
              stroke="none"
              fill="var(--primary)"
              fillOpacity={0.1}
              isAnimationActive={false}
              activeDot={false}
            />
            <Line dataKey="bull" stroke="var(--bull)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line
              dataKey="base"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ r: 2, fill: "var(--primary)" }}
              isAnimationActive={false}
            />
            <Line dataKey="bear" stroke="var(--bear)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 hidden h-[54px] w-full sm:block">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points.slice(1)} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} onClick={handleClick}>
            <XAxis dataKey="label" hide />
            <YAxis domain={[0, 100]} width={58} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
            <Tooltip
              cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as Point | undefined;
                return p ? (
                  <div className="rounded-lg border border-border/60 bg-popover/95 px-2 py-1 text-[10px] shadow-lg">
                    {p.label} · {p.confidence}% confidence
                  </div>
                ) : null;
              }}
            />
            <Bar dataKey="confidence" fill="var(--primary)" fillOpacity={0.45} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-3 px-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-bull" /> bull</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-primary" /> base</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-bear" /> bear</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 bg-primary/15" /> expected range</span>
        <span className="hidden sm:inline">lower strip: confidence by horizon</span>
      </div>
    </div>
  );
}
