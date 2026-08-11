import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Waves } from "lucide-react";

import { BullBearGauge } from "@/components/soliq/BullBearGauge";
import { useWhaleFeed } from "@/hooks/use-whales";

export function fmtBig(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

export function TideSpark({ points }: { points: { t: number; callPrem: number; putPrem: number }[] }) {
  const data = points.map((p) => p.callPrem - p.putPrem);
  if (data.length < 2) return null;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0);
  const span = max - min || 1;
  const y = (v: number) => 34 - ((v - min) / span) * 32;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${y(v)}`).join(" ");
  const up = (data.at(-1) ?? 0) >= 0;
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-10 w-full">
      <line x1="0" x2="100" y1={y(0)} y2={y(0)} stroke="currentColor" strokeWidth="0.5" className="text-border" />
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "var(--bull)" : "var(--bear)"}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Compact whale-flow conviction card, reused across the app. */
export function WhaleSignalCard({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, isError } = useWhaleFeed();

  if (isLoading) {
    return (
      <div className="panel p-4">
        <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Whale flow</p>
        <p className="mt-2 text-xs text-muted-foreground">Loading institutional options tape…</p>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="panel p-4">
        <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Whale flow</p>
        <p className="mt-2 text-xs text-bear">Whale feed unavailable right now.</p>
      </div>
    );
  }

  const s = data.signal;
  const tone = s.tilt > 0.12 ? "text-bull" : s.tilt < -0.12 ? "text-bear" : "text-muted-foreground";

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">
          <Waves className="size-3 text-primary" /> Whale flow · Unusual Whales
        </p>
        <Link to="/whales" className="inline-flex items-center gap-0.5 text-[10px] text-primary">
          Dashboard <ArrowUpRight className="size-3" />
        </Link>
      </div>
      <p className={`font-display mt-1 text-lg font-semibold ${tone}`}>{s.label}</p>
      <TideSpark points={data.tide} />
      <BullBearGauge bull={s.bull} bear={s.bear} confidence={s.confidence} compact />
      {!compact && (
        <>
          <p className="mt-2 text-[11px] text-muted-foreground">{s.headline}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-surface-2/50 p-2">
              <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Net premium</p>
              <p className={`num text-xs font-medium ${s.netPremium >= 0 ? "text-bull" : "text-bear"}`}>
                {fmtBig(s.netPremium)}
              </p>
            </div>
            <div className="rounded-lg bg-surface-2/50 p-2">
              <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Put / call</p>
              <p className="num text-xs font-medium">{s.putCallRatio.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-surface-2/50 p-2">
              <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Net volume</p>
              <p className={`num text-xs font-medium ${s.netVolume >= 0 ? "text-bull" : "text-bear"}`}>
                {Math.round(s.netVolume).toLocaleString("en-US")}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** One-line whale strip for dense headers. */
export function WhaleStrip() {
  const { data } = useWhaleFeed();
  if (!data) return null;
  const s = data.signal;
  return (
    <Link
      to="/whales"
      className="panel flex items-center gap-3 px-3 py-2 text-[11px] transition-colors hover:border-primary/40"
    >
      <Waves className="size-3.5 text-primary" />
      <span className="text-muted-foreground">Whale flow</span>
      <span className={s.tilt >= 0 ? "text-bull" : "text-bear"}>{s.label}</span>
      <span className="num text-muted-foreground">net {fmtBig(s.netPremium)}</span>
      <span className="num ml-auto text-muted-foreground">{s.bull}% bull</span>
    </Link>
  );
}
