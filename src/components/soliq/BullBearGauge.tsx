/** Bullish ⇄ bearish conviction gauge, optionally overlaid with whale-flow tilt. */
export function BullBearGauge({
  bull,
  bear,
  confidence,
  compact = false,
  whaleBull,
}: {
  bull: number;
  bear: number;
  confidence?: number;
  compact?: boolean;
  /** 0-100 bullish share derived from institutional whale flow. */
  whaleBull?: number;
}) {
  const total = Math.max(1, bull + bear);
  const bullPct = Math.round((bull / total) * 100);
  const net = bullPct - 50;
  const label = net > 18 ? "Strong bullish" : net > 6 ? "Bullish" : net < -18 ? "Strong bearish" : net < -6 ? "Bearish" : "Neutral";
  const tone = net > 6 ? "text-bull" : net < -6 ? "text-bear" : "text-muted-foreground";


  return (
    <div className={compact ? "w-full" : "panel w-full p-4"}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Bull / bear gauge</p>
          <p className={`font-display text-lg font-semibold ${tone}`}>{label}</p>
        </div>
        <div className="text-right">
          <p className="num text-sm">
            <span className="text-bull">{bullPct}%</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-bear">{100 - bullPct}%</span>
          </p>
          {confidence !== undefined && (
            <p className="num text-[10px] text-muted-foreground">AI confidence {Math.round(confidence)}%</p>
          )}
        </div>
      </div>

      <div className="relative mt-3 h-2.5 rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 rounded-full bg-bear/70" style={{ width: `${100 - bullPct}%` }} />
        <div className="absolute inset-y-0 right-0 rounded-full bg-bull" style={{ width: `${bullPct}%` }} />
        <div
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground"
          style={{ left: `${100 - bullPct}%` }}
        />
        {whaleBull !== undefined && (
          <div
            className="absolute -top-1.5 h-5.5 w-0.5 -translate-x-1/2 rounded-full bg-primary"
            style={{ left: `${100 - Math.round(whaleBull)}%` }}
            title={`Whale flow ${Math.round(whaleBull)}% bullish`}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>Bearish</span>
        <span>{whaleBull !== undefined ? <span className="text-primary">| whale flow</span> : "Neutral"}</span>
        <span>Bullish</span>
      </div>

    </div>
  );
}
