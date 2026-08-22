import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Newspaper } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/soliq/AppShell";
import { ProjectionPanel } from "@/components/soliq/ProjectionPanel";
import { DataStatus } from "@/components/soliq/DataState";
import { SymbolChart } from "@/components/soliq/SymbolChart";
import { Button } from "@/components/ui/button";
import { useSymbolDashboard } from "@/hooks/use-symbol";
import { fmtNum, fmtUsd } from "@/lib/format";
import { deskTimeframes, marketLabels, type DeskTf, type SymbolMarket } from "@/lib/timeframes";

export const Route = createFileRoute("/symbol/$market/$symbol")({
  head: ({ params }) => {
    const sym = params.symbol.toUpperCase();
    const title = `${sym} live chart, analytics & news — SOLIQ`;
    const description = `${sym} live price action, 1m–1D candles, RSI/MACD/VWAP indicators, volume momentum, float, short interest, balance sheet and market news.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: SymbolPage,
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert" className="py-24 text-center text-sm text-bear">
        {error.message}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="py-24 text-center text-sm text-muted-foreground">Symbol not found.</p>
    </AppShell>
  ),
});

const markets: SymbolMarket[] = ["stocks", "crypto", "fx", "indices", "futures"];

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" | undefined }) {
  return (
    <div className="panel p-3">
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`num mt-1 text-sm font-medium ${tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : ""}`}>
        {value}
      </p>
    </div>
  );
}

const money = (n: number | null | undefined) => (n === null || n === undefined ? "—" : fmtUsd(n));
const count = (n: number | null | undefined) => (n === null || n === undefined ? "—" : fmtNum(n));
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`);

function SymbolPage() {
  const params = Route.useParams();
  const market = (markets as string[]).includes(params.market) ? (params.market as SymbolMarket) : "stocks";
  const symbol = params.symbol.toUpperCase();
  const [tf, setTf] = useState<DeskTf>("5m");
  const { data, isLoading, isError, error } = useSymbolDashboard(market, symbol, tf);

  const a = data?.action;
  const i = data?.indicators;
  const v = data?.volume;
  const f = data?.fundamentals;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{marketLabels[market]}</p>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {data?.display ?? symbol}{" "}
              {f?.name ? <span className="text-sm font-normal text-muted-foreground">{f.name}</span> : null}
            </h1>
            <p className="num mt-1 text-sm">
              {a ? money(a.last) : "—"}{" "}
              <span className={a && a.changePct >= 0 ? "text-bull" : "text-bear"}>
                {a ? `${pct(a.changePct)} (${a.changeAbs >= 0 ? "+" : ""}${a.changeAbs})` : ""}
              </span>
            </p>
            <div className="mt-2">
              <DataStatus
                state={
                  isLoading ? "loading"
                  : isError ? "error"
                  : !data || data.source === "none" ? "unavailable"
                  : data.source === "tape" ? "delayed"
                  : "live"
                }
                source={
                  data?.source === "massive" ? "Massive"
                  : data?.source === "tape" ? "Backup tape"
                  : null
                }
                fetchedAt={data?.updatedAt ?? null}
                ageMs={data ? Math.max(0, Date.now() - data.updatedAt) : null}
                fallback={data?.source === "tape"}
              />
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {deskTimeframes.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={tf === t.id ? "subtle" : "ghost"}
                onClick={() => setTf(t.id)}
                className="h-7 px-2 text-[11px]"
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading live {symbol} data…
          </div>
        ) : isError ? (
          <p className="py-24 text-center text-sm text-bear">{(error as Error)?.message ?? "Symbol unavailable"}</p>
        ) : (
          <>
            {(data?.notes.length ?? 0) > 0 && (
              <ul className="panel space-y-1 p-3 text-[11px] text-muted-foreground">
                {data?.notes.map((n) => <li key={n}>· {n}</li>)}
              </ul>
            )}

            <ProjectionPanel projection={data?.projection ?? null} title={`${data?.display ?? symbol} price projection`} />

            <div className="grid gap-4 lg:grid-cols-[1fr_290px]">
              <SymbolChart bars={data?.bars ?? []} timeframe={tf} />

              <div className="space-y-4">
                <div className="panel p-4">
                  <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Price action</p>
                  <div className="mt-2 space-y-1.5 text-xs">
                    {[
                      ["Open", a ? money(a.open) : "—"],
                      ["Session high", a ? money(a.sessionHigh) : "—"],
                      ["Session low", a ? money(a.sessionLow) : "—"],
                      ["Prev close", a ? money(a.prevClose) : "—"],
                      ["Gap", a ? pct(a.gapPct) : "—"],
                      ["Range", a ? `${a.rangePct.toFixed(2)}%` : "—"],
                      ["VWAP dist", a ? pct(a.vwapDist) : "—"],
                      ["ATR", a ? money(a.atr) : "—"],
                      ["Trend", a?.trend ?? "—"],
                    ].map(([k, val]) => (
                      <p key={k} className="flex justify-between">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="num">{val}</span>
                      </p>
                    ))}
                  </div>
                </div>

                <div className="panel p-4">
                  <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Volume momentum</p>
                  <div className="mt-2 space-y-1.5 text-xs">
                    {[
                      ["Bar volume", v ? count(v.volume) : "—"],
                      ["Avg volume", v ? count(v.avgVolume) : "—"],
                      ["Rel volume", v ? `${v.relVolume}x` : "—"],
                      ["Flow state", v?.volumeTrend ?? "—"],
                      ["Up / down bars", v ? `${v.upBars} / ${v.downBars}` : "—"],
                      ["Buy-side flow", v ? `${v.netFlowPct}%` : "—"],
                      ["Momentum 5", v ? pct(v.momentum5) : "—"],
                      ["Momentum 20", v ? pct(v.momentum20) : "—"],
                    ].map(([k, val]) => (
                      <p key={k} className="flex justify-between">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="num">{val}</span>
                      </p>
                    ))}
                  </div>
                </div>

                <div className="panel p-4">
                  <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Pivot levels</p>
                  <div className="mt-2 space-y-1.5 text-xs">
                    {(data?.levels ?? []).map((l) => (
                      <p key={l.label} className="flex justify-between">
                        <span className="text-muted-foreground">{l.label}</span>
                        <span className="num">{money(l.value)}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="RSI (14)" value={i ? i.rsi14.toFixed(1) : "—"} />
              <Stat label="MACD hist" value={i ? i.macdHist.toFixed(4) : "—"} />
              <Stat label="MACD / signal" value={i ? `${i.macd.toFixed(3)} / ${i.macdSignal.toFixed(3)}` : "—"} />
              <Stat label="EMA 20 / 50" value={i ? `${money(i.ema20)} / ${money(i.ema50)}` : "—"} />
              <Stat label="VWAP" value={i ? money(i.vwap) : "—"} />
              <Stat label="ATR %" value={i ? `${i.atrPct.toFixed(2)}%` : "—"} />
              <Stat
                label="Engine verdict"
                value={i ? `${i.verdict.toUpperCase()} · ${i.score}` : "—"}
                {...(i ? { tone: i.verdict === "buy" ? ("bull" as const) : i.verdict === "sell" ? ("bear" as const) : undefined } : {})}
              />
              <Stat label="Support" value={a ? money(a.support) : "—"} />
              <Stat label="Resistance" value={a ? money(a.resistance) : "—"} />
              <Stat label="Market cap" value={money(f?.marketCap)} />
              <Stat label="Shares out" value={count(f?.shares)} />
              <Stat label="Float" value={count(f?.float?.float)} />
              <Stat label="Short interest" value={count(f?.shortInterest?.[0]?.shortInterest)} />
              <Stat label="Short % float" value={f?.float?.shortPctFloat ? `${f.float.shortPctFloat}%` : "—"} />
              <Stat label="Days to cover" value={f?.float?.daysToCover ? f.float.daysToCover.toFixed(2) : "—"} />
              <Stat label="Put/call ratio" value={f?.options?.putCallRatio ? f.options.putCallRatio.toFixed(2) : "—"} />
              <Stat label="Call / put vol" value={f?.options ? `${count(f.options.callVolume)} / ${count(f.options.putVolume)}` : "—"} />
              <Stat label="Call / put OI" value={f?.options ? `${count(f.options.callOi)} / ${count(f.options.putOi)}` : "—"} />
            </div>

            {f && (f.quarterly.length > 0 || f.annual.length > 0) && (
              <div className="panel overflow-x-auto p-4">
                <p className="text-xs font-medium">Balance sheet &amp; income (last reported periods)</p>
                <table className="mt-3 w-full min-w-[720px] text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      {["Period", "Revenue", "Gross profit", "Operating income", "Net income", "EPS", "Assets", "Liabilities", "Equity", "Cash flow"].map(
                        (h) => (
                          <th key={h} className="py-1.5 pr-3 font-normal">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="num">
                    {(f.quarterly.length ? f.quarterly : f.annual).slice(0, 8).map((p) => (
                      <tr key={`${p.fiscalYear}-${p.period}-${p.end}`} className="border-t border-border/60">
                        <td className="py-1.5 pr-3">
                          {p.fiscalYear} {p.period}
                        </td>
                        <td className="pr-3">{money(p.revenue)}</td>
                        <td className="pr-3">{money(p.grossProfit)}</td>
                        <td className="pr-3">{money(p.operatingIncome)}</td>
                        <td className="pr-3">{money(p.netIncome)}</td>
                        <td className="pr-3">{p.eps === null ? "—" : p.eps.toFixed(2)}</td>
                        <td className="pr-3">{money(p.assets)}</td>
                        <td className="pr-3">{money(p.liabilities)}</td>
                        <td className="pr-3">{money(p.equity)}</td>
                        <td className="pr-3">{money(p.cashFlow)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(f?.shortInterest.length ?? 0) > 0 && (
              <div className="panel overflow-x-auto p-4">
                <p className="text-xs font-medium">Short interest history</p>
                <table className="mt-3 w-full min-w-[520px] text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      {["Settlement", "Short interest", "Short volume", "Avg daily volume", "Days to cover"].map((h) => (
                        <th key={h} className="py-1.5 pr-3 font-normal">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="num">
                    {f?.shortInterest.map((s) => (
                      <tr key={s.settlementDate} className="border-t border-border/60">
                        <td className="py-1.5 pr-3">{s.settlementDate || "—"}</td>
                        <td className="pr-3">{count(s.shortInterest)}</td>
                        <td className="pr-3">{count(s.shortVolume)}</td>
                        <td className="pr-3">{count(s.avgDailyVolume)}</td>
                        <td className="pr-3">{s.daysToCover === null ? "—" : s.daysToCover.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="panel p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <Newspaper className="size-3.5 text-primary" /> {symbol} news wire
              </p>
              {(data?.news.length ?? 0) === 0 ? (
                <p className="mt-2 text-[11px] text-muted-foreground">No headlines returned for this symbol right now.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data?.news.map((n) => (
                    <li key={n.url} className="border-t border-border/60 pt-2 first:border-0 first:pt-0">
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-xs font-medium hover:text-primary"
                      >
                        {n.title}
                      </a>
                      <p className="num mt-0.5 text-[10px] text-muted-foreground">
                        {n.publisher} · {new Date(n.publishedAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {f?.description && (
              <div className="panel p-4">
                <p className="text-xs font-medium">About {f.name ?? symbol}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{f.description}</p>
                <p className="num mt-2 text-[10px] text-muted-foreground">
                  {f.exchange ?? "—"} · {f.employees ? `${count(f.employees)} employees` : "employees n/a"} ·{" "}
                  {f.listDate ? `listed ${f.listDate}` : "list date n/a"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
