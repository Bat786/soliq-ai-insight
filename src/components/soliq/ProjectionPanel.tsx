/**
 * Shared projection surface for every projectable market (stocks, ETFs, futures,
 * FX, commodities, major crypto). Memecoins never reach here — their loaders
 * return `null`, and this component renders nothing for a null set.
 */

import { useState } from "react";

import { ProjectionFanChart } from "@/components/soliq/ProjectionFanChart";
import type { Projection, ProjectionSet } from "@/lib/projections";

const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

/** Adaptive price formatting: FX crosses need 4-5 digits, indices need 2. */
const fmtPx = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (abs >= 100) return `$${n.toFixed(2)}`;
  if (abs >= 1) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(4)}`;
};

function CaseRow({ label, tone, price, changePct }: { label: string; tone: string; price: number; changePct: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="num text-xs font-medium">{fmtPx(price)}</span>
      <span className={`num w-16 text-right text-[11px] ${tone}`}>{fmtPct(changePct)}</span>
    </div>
  );
}

function HorizonCard({ h, active, onSelect }: { h: Projection; active: boolean; onSelect: () => void }) {
  const tone = h.direction === "up" ? "text-bull" : h.direction === "down" ? "text-bear" : "text-muted-foreground";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl p-2 text-left transition-colors ${active ? "bg-primary/12 ring-1 ring-primary/40" : "bg-surface-2/50 hover:bg-surface-2"}`}
    >
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{h.label}</p>
      <p className="num text-xs font-medium">{fmtPx(h.base.price)}</p>
      <p className={`num text-[11px] ${tone}`}>{fmtPct(h.base.changePct)}</p>
      <p className="num text-[10px] text-muted-foreground">{h.confidence}% conf</p>
    </button>
  );
}

export function ProjectionPanel({
  projection,
  title = "PRISM projection",
  note,
}: {
  projection: ProjectionSet | null | undefined;
  title?: string;
  note?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  if (!projection || projection.horizons.length === 0) return null;

  const active =
    projection.horizons.find((h) => h.horizon === selected) ??
    projection.horizons.find((h) => h.horizon === "1h") ??
    projection.horizons[0]!;

  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium">{title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {projection.model} · {projection.sampleDays}d data sample · {projection.volatilityPct}% annualised risk
          </p>
        </div>
        <p className="num text-[11px] text-muted-foreground">spot {fmtPx(projection.current)}</p>
      </div>

      {note ? <p className="mt-2 text-[11px] text-muted-foreground">{note}</p> : null}

      <ProjectionFanChart projection={projection} selected={active.horizon} onSelect={setSelected} />

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {projection.horizons.map((h) => (
          <HorizonCard key={h.horizon} h={h} active={h.horizon === active.horizon} onSelect={() => setSelected(h.horizon)} />
        ))}
      </div>


      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-surface-2/50 p-3">
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{active.label} scenarios</p>
          <div className="mt-2 space-y-1.5">
            <CaseRow label="Bull case" tone="text-bull" price={active.bull.price} changePct={active.bull.changePct} />
            <CaseRow label="Base case" tone="text-foreground" price={active.base.price} changePct={active.base.changePct} />
            <CaseRow label="Bear case" tone="text-bear" price={active.bear.price} changePct={active.bear.changePct} />
          </div>
          <p className="num mt-2 text-[10px] text-muted-foreground">
            expected range {fmtPx(active.low)}–{fmtPx(active.high)} · {active.confidence}% confidence
          </p>
        </div>

        <div className="rounded-xl bg-surface-2/50 p-3">
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Signals behind this read</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {projection.drivers.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">No dominant signal — market context is trend-neutral.</span>
            ) : (
              projection.drivers.map((d) => (
                <span key={d} className="rounded-md bg-primary/12 px-2 py-0.5 text-[11px] text-primary">
                  {d}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">{projection.disclaimer}</p>
    </section>
  );
}
