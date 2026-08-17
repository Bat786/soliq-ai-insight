import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { fmtPct, fmtUsd } from "@/lib/format";

/** Minimal shape any live market row satisfies (crypto universe, tape rows, wallet holdings). */
export type AssetLike = {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap?: number;
  image?: string | null;
  series?: number[];
};

export function Sparkline({ data, up, className = "" }: { data: number[]; up: boolean; className?: string }) {
  if (!data || data.length < 2) return <div className={`h-8 w-full ${className}`} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / span) * 26}`).join(" ");
  const stroke = up ? "var(--bull)" : "var(--bear)";
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={`h-8 w-full ${className}`}>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
  as: Heading = "h2",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Heading level — use "h1" for a page's primary title. */
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <Heading className="font-display text-base font-semibold">{title}</Heading>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}


export function Delta({ value, className = "" }: { value: number; className?: string }) {
  const up = value >= 0;
  return (
    <span
      className={`num inline-flex items-center gap-1 text-xs font-medium ${up ? "text-bull" : "text-bear"} ${className}`}
    >
      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {fmtPct(value)}
    </span>
  );
}

export function ScoreRing({ score }: { score: number }) {
  const tone = score >= 85 ? "text-bull" : score >= 70 ? "text-primary" : score >= 55 ? "text-warn" : "text-bear";
  return (
    <div className="flex items-baseline gap-1">
      <span className={`num font-display text-lg font-bold ${tone}`}>{score}</span>
      <span className="text-[10px] text-muted-foreground">/100</span>
    </div>
  );
}

export function RiskBar({ risk }: { risk: number }) {
  const tone = risk > 70 ? "bg-bear" : risk > 45 ? "bg-warn" : "bg-bull";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${risk}%` }} />
      </div>
      <span className="num text-[10px] text-muted-foreground">risk {risk}</span>
    </div>
  );
}

export function AssetPill({ asset }: { asset: AssetLike }) {
  return (
    <div className="flex items-center gap-2.5">
      {asset.image ? (
        <img src={asset.image} alt="" loading="lazy" className="size-8 shrink-0 rounded-lg bg-surface-2" />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-[10px] font-semibold">
          {asset.symbol.slice(0, 3)}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{asset.name}</p>
        <p className="num text-[11px] text-muted-foreground">
          {asset.symbol}
          {asset.marketCap ? ` · ${fmtUsd(asset.marketCap)}` : ""}
        </p>
      </div>
    </div>
  );
}

export function AssetRow({ asset }: { asset: AssetLike }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <AssetPill asset={asset} />
      </div>
      {!!asset.series?.length && (
        <div className="hidden w-16 shrink-0 sm:block">
          <Sparkline data={asset.series} up={asset.change24h >= 0} />
        </div>
      )}
      <div className="w-24 shrink-0 text-right">
        <p className="num text-sm">{fmtUsd(asset.price)}</p>
        <Delta value={asset.change24h} />
      </div>
    </div>
  );
}

export function StatCard({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="panel p-4">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="num mt-1.5 font-display text-xl font-semibold">{value}</p>
      {delta !== undefined && <Delta value={delta} className="mt-1" />}
    </div>
  );
}
