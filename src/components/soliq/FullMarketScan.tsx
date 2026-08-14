import { useState } from "react";

import { Input } from "@/components/ui/input";
import { useCryptoScan, useMarketScan } from "@/hooks/use-scan";
import { fmtCompact, fmtPct, fmtUsd } from "@/lib/format";
import type { ScanRow } from "@/lib/scan.server";

const sessionLabel: Record<string, string> = {
  "pre-market": "Pre-market scan",
  live: "Live market scan",
  "after-hours": "After-hours scan",
  closed: "Last close scan",
};

function Table({ title, rows }: { title: string; rows: ScanRow[] }) {
  return (
    <div className="panel p-4">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No matches for these filters.</p>
      ) : (
        <div className="mt-2 space-y-1">
          {rows.map((r) => (
            <div key={r.ticker} className="flex items-center justify-between gap-2 border-b border-border/50 py-1.5 last:border-0">
              <span className="num text-sm font-semibold">{r.ticker}</span>
              <div className="flex items-center gap-3 text-right">
                <span className="num text-xs">{fmtUsd(r.price)}</span>
                <span className={`num w-16 text-xs ${r.changePct >= 0 ? "text-bull" : "text-bear"}`}>
                  {fmtPct(r.changePct)}
                </span>
                <span className="num w-16 text-[11px] text-muted-foreground">{fmtCompact(r.volume)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Whole-tape scanner: one snapshot call, ranked server-side. */
export function FullMarketScan() {
  const [minPrice, setMinPrice] = useState(1);
  const [maxPrice, setMaxPrice] = useState(500);
  const [minVolume, setMinVolume] = useState(500_000);
  const [minChangePct, setMinChangePct] = useState(0);

  const { data, isLoading } = useMarketScan({ minPrice, maxPrice, minVolume, minChangePct, topN: 15 });

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{sessionLabel[data?.session ?? "closed"]}</p>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Pulling the full US tape…" : `${(data?.scanned ?? 0).toLocaleString()} tickers scanned in one call`}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Min price", value: minPrice, set: setMinPrice },
            { label: "Max price", value: maxPrice, set: setMaxPrice },
            { label: "Min volume", value: minVolume, set: setMinVolume },
            { label: "Min |change| %", value: minChangePct, set: setMinChangePct },
          ].map((f) => (
            <label key={f.label} className="text-[11px] font-medium text-muted-foreground">
              {f.label}
              <Input
                type="number"
                className="num mt-1"
                value={f.value}
                onChange={(e) => f.set(Number(e.target.value) || 0)}
              />
            </label>
          ))}
        </div>
        {!!data?.notes.length && (
          <p className="mt-2 text-[11px] text-warn">{data.notes.join(" · ")}</p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Table title="TOP GAINERS" rows={data?.gainers ?? []} />
        <Table title="TOP LOSERS" rows={data?.losers ?? []} />
        <Table title="HIGHEST VOLUME" rows={data?.highVolume ?? []} />
      </div>
    </div>
  );
}

/** Crypto scan across pump.fun launches (via DexScreener) and CoinGecko majors. */
export function CryptoScanBoard() {
  const { data, isLoading } = useCryptoScan();

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <p className="text-sm font-semibold">Crypto market scan</p>
        <p className="text-xs text-muted-foreground">
          {isLoading
            ? "Scanning launches and majors…"
            : `${data?.launches.length ?? 0} pump.fun launches · ${data?.majors.length ?? 0} majors by volume`}
        </p>
        {!!data?.notes.length && <p className="mt-2 text-[11px] text-warn">{data.notes.join(" · ")}</p>}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {[
          { title: "PUMP.FUN LAUNCHES", rows: data?.launches ?? [] },
          { title: "MAJORS BY 24H VOLUME", rows: data?.majors ?? [] },
        ].map((block) => (
          <div key={block.title} className="panel p-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">{block.title}</p>
            <div className="mt-2 space-y-1">
              {block.rows.slice(0, 15).map((r) => (
                <div
                  key={`${block.title}-${r.symbol}-${r.url ?? r.name}`}
                  className="flex items-center justify-between gap-2 border-b border-border/50 py-1.5 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="num truncate text-sm font-semibold">{r.symbol}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{r.name || r.source}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="num text-xs">{fmtUsd(r.price)}</span>
                    <span className={`num w-16 text-right text-xs ${r.changePct >= 0 ? "text-bull" : "text-bear"}`}>
                      {fmtPct(r.changePct)}
                    </span>
                    <span className="num w-16 text-right text-[11px] text-muted-foreground">{fmtCompact(r.volume)}</span>
                  </div>
                </div>
              ))}
              {block.rows.length === 0 && <p className="text-xs text-muted-foreground">No data right now.</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
