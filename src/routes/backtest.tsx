import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical, Loader2, Play } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/soliq/AppShell";
import { toCandles, resolveInterval, type Candle, type IntervalId } from "@/components/soliq/CandleChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssetDetail, useMarket } from "@/hooks/use-market";
import { fmtPctc, fmtUsdc } from "@/lib/market-types";

export const Route = createFileRoute("/backtest")({
  head: () => ({
    meta: [
      { title: "Backtesting workspace — paper-trade strategies | SOLIQ" },
      {
        name: "description",
        content:
          "Test MA crossover, RSI mean-reversion and breakout strategies on historical crypto data with paper money and full performance analytics.",
      },
      { property: "og:title", content: "SOLIQ backtesting workspace" },
      {
        property: "og:description",
        content: "Paper-money strategy testing on historical crypto data with equity curve and risk analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BacktestPage,
});

type StrategyId = "ma-cross" | "rsi-revert" | "breakout";

const strategies: { id: StrategyId; name: string; blurb: string }[] = [
  { id: "ma-cross", name: "MA crossover", blurb: "Long when fast MA crosses above slow MA, flat on cross down." },
  { id: "rsi-revert", name: "RSI mean reversion", blurb: "Buy oversold RSI, exit when RSI returns above the upper band." },
  { id: "breakout", name: "Donchian breakout", blurb: "Long on N-bar high breakout, exit on N-bar low breakdown." },
];

const ranges = [
  { label: "1M", days: 30, interval: "1h" as IntervalId },
  { label: "3M", days: 90, interval: "4h" as IntervalId },
  { label: "1Y", days: 365, interval: "1d" as IntervalId },
  { label: "5Y", days: 1825, interval: "1d" as IntervalId },
];

function smaArr(values: number[], period: number) {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

function rsiArr(values: number[], period = 14) {
  const out: (number | null)[] = [null];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    const g = Math.max(0, d);
    const l = Math.max(0, -d);
    if (i <= period) {
      gain += g;
      loss += l;
      out.push(i === period ? 100 - 100 / (1 + gain / Math.max(1e-9, loss)) : null);
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      out.push(100 - 100 / (1 + gain / Math.max(1e-9, loss)));
    }
  }
  return out;
}

export type Trade = {
  entryTime: number;
  exitTime: number;
  entry: number;
  exit: number;
  pnl: number;
  pnlPct: number;
};

export type BacktestResult = {
  trades: Trade[];
  equity: { t: number; v: number }[];
  finalEquity: number;
  returnPct: number;
  buyHoldPct: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownPct: number;
  avgTradePct: number;
  bestPct: number;
  worstPct: number;
  exposurePct: number;
};

/** Long/flat paper-money simulation with per-trade fees. */
export function runBacktest(
  candles: Candle[],
  opts: { strategy: StrategyId; fast: number; slow: number; capital: number; feePct: number },
): BacktestResult | null {
  if (candles.length < Math.max(30, opts.slow + 2)) return null;
  const closes = candles.map((c) => c.close);
  const fast = smaArr(closes, Math.max(2, opts.fast));
  const slow = smaArr(closes, Math.max(3, opts.slow));
  const rsi = rsiArr(closes);
  const fee = Math.max(0, opts.feePct) / 100;

  const long = (i: number): boolean => {
    if (opts.strategy === "ma-cross") {
      const f = fast[i];
      const s = slow[i];
      return f != null && s != null && f > s;
    }
    if (opts.strategy === "rsi-revert") {
      const r = rsi[i];
      return r != null && r < 40;
    }
    const look = Math.max(3, opts.fast);
    if (i < look) return false;
    const window = candles.slice(i - look, i);
    const hi = Math.max(...window.map((c) => c.high));
    const lo = Math.min(...window.map((c) => c.low));
    return candles[i]!.close >= hi || (candles[i]!.close > lo && closes[i]! > (slow[i] ?? closes[i]!));
  };

  let cash = opts.capital;
  let units = 0;
  let entry = 0;
  let entryTime = 0;
  let barsIn = 0;
  const trades: Trade[] = [];
  const equity: { t: number; v: number }[] = [];

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const t = (c.time as unknown as number) * 1000;
    const want = long(i);

    if (want && units === 0) {
      const spend = cash * (1 - fee);
      units = spend / c.close;
      cash = 0;
      entry = c.close;
      entryTime = t;
    } else if (!want && units > 0) {
      const proceeds = units * c.close * (1 - fee);
      const cost = units * entry;
      trades.push({
        entryTime,
        exitTime: t,
        entry,
        exit: c.close,
        pnl: proceeds - cost,
        pnlPct: ((c.close - entry) / entry) * 100 - fee * 200,
      });
      cash = proceeds;
      units = 0;
    }
    if (units > 0) barsIn++;
    equity.push({ t, v: cash + units * c.close });
  }

  if (units > 0) {
    const last = candles[candles.length - 1]!;
    const proceeds = units * last.close * (1 - fee);
    trades.push({
      entryTime,
      exitTime: (last.time as unknown as number) * 1000,
      entry,
      exit: last.close,
      pnl: proceeds - units * entry,
      pnlPct: ((last.close - entry) / entry) * 100 - fee * 200,
    });
    cash = proceeds;
    units = 0;
  }

  const finalEquity = cash;
  const wins = trades.filter((t) => t.pnl > 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0));
  let peak = 0;
  let maxDd = 0;
  for (const e of equity) {
    peak = Math.max(peak, e.v);
    maxDd = Math.max(maxDd, ((peak - e.v) / (peak || 1)) * 100);
  }
  const first = closes[0]!;
  const lastClose = closes[closes.length - 1]!;

  return {
    trades,
    equity,
    finalEquity,
    returnPct: ((finalEquity - opts.capital) / opts.capital) * 100,
    buyHoldPct: ((lastClose - first) / first) * 100,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    maxDrawdownPct: maxDd,
    avgTradePct: trades.length ? trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length : 0,
    bestPct: trades.length ? Math.max(...trades.map((t) => t.pnlPct)) : 0,
    worstPct: trades.length ? Math.min(...trades.map((t) => t.pnlPct)) : 0,
    exposurePct: (barsIn / Math.max(1, candles.length - 1)) * 100,
  };
}

function EquityCurve({ equity, capital }: { equity: { t: number; v: number }[]; capital: number }) {
  if (equity.length < 2) return null;
  const values = equity.map((e) => e.v);
  const min = Math.min(...values, capital);
  const max = Math.max(...values, capital);
  const span = max - min || 1;
  const d = equity
    .map((e, i) => `${i === 0 ? "M" : "L"}${(i / (equity.length - 1)) * 100},${100 - ((e.v - min) / span) * 100}`)
    .join(" ");
  const up = values[values.length - 1]! >= capital;
  const base = 100 - ((capital - min) / span) * 100;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full">
      <line x1="0" y1={base} x2="100" y2={base} stroke="currentColor" className="text-border" strokeWidth="0.4" />
      <path d={d} fill="none" strokeWidth="1.2" className={up ? "text-bull" : "text-bear"} stroke="currentColor" />
    </svg>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  return (
    <div className="panel p-3">
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`num mt-1 text-sm font-medium ${tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function BacktestPage() {
  const { data: snapshot } = useMarket();
  const universe = snapshot?.rows ?? [];

  const [assetId, setAssetId] = useState("bitcoin");
  const [rangeIdx, setRangeIdx] = useState(2);
  const [strategy, setStrategy] = useState<StrategyId>("ma-cross");
  const [fast, setFast] = useState(9);
  const [slow, setSlow] = useState(21);
  const [capital, setCapital] = useState(10_000);
  const [feePct, setFeePct] = useState(0.1);
  const [ran, setRan] = useState(true);

  const range = ranges[rangeIdx]!;
  const { data, isLoading } = useAssetDetail(assetId, range.days);
  const points = data?.history.prices ?? [];

  const candles = useMemo(() => {
    if (points.length === 0) return [];
    const iv = resolveInterval(points, range.interval, 40);
    return toCandles(points, iv, data?.history.volumes);
  }, [points, range.interval, data?.history.volumes]);

  const result = useMemo(
    () => (ran ? runBacktest(candles, { strategy, fast, slow, capital, feePct }) : null),
    [ran, candles, strategy, fast, slow, capital, feePct],
  );

  const activeStrategy = strategies.find((s) => s.id === strategy)!;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <FlaskConical className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Backtesting workspace</h1>
            <p className="text-xs text-muted-foreground">
              Paper-money strategy testing on historical data. Results are simulated — not financial advice.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="panel space-y-3 p-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Asset</Label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(universe.length ? universe.slice(0, 60) : [{ id: "bitcoin", symbol: "BTC", name: "Bitcoin" }]).map(
                    (a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.symbol} · {a.name}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">History window</Label>
              <div className="flex gap-1">
                {ranges.map((r, i) => (
                  <Button
                    key={r.label}
                    size="sm"
                    variant={rangeIdx === i ? "subtle" : "ghost"}
                    className="h-7 flex-1 px-2 text-[11px]"
                    onClick={() => setRangeIdx(i)}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Strategy</Label>
              <Select value={strategy} onValueChange={(v) => setStrategy(v as StrategyId)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {strategies.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{activeStrategy.blurb}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">
                  {strategy === "breakout" ? "Lookback" : "Fast / RSI"}
                </Label>
                <Input
                  type="number"
                  className="num h-9"
                  value={fast}
                  onChange={(e) => setFast(Math.max(2, Number(e.target.value) || 2))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Slow / trend</Label>
                <Input
                  type="number"
                  className="num h-9"
                  value={slow}
                  onChange={(e) => setSlow(Math.max(3, Number(e.target.value) || 3))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Paper capital</Label>
                <Input
                  type="number"
                  className="num h-9"
                  value={capital}
                  onChange={(e) => setCapital(Math.max(100, Number(e.target.value) || 100))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Fee %</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="num h-9"
                  value={feePct}
                  onChange={(e) => setFeePct(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            </div>

            <Button variant="hero" className="w-full" onClick={() => setRan(true)} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Run backtest
            </Button>
            <p className="num text-[10px] text-muted-foreground">
              {candles.length} candles loaded{data?.history.synthetic ? " · modelled series" : ""}
            </p>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="panel flex items-center justify-center gap-2 p-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading historical data…
              </div>
            ) : !result ? (
              <div className="panel p-16 text-center text-sm text-muted-foreground">
                Not enough history for these settings — widen the window or lower the slow period.
              </div>
            ) : (
              <>
                <div className="panel p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-medium">Equity curve</p>
                    <p className="num text-sm">
                      {fmtUsdc(result.finalEquity)}{" "}
                      <span className={result.returnPct >= 0 ? "text-bull" : "text-bear"}>
                        {fmtPctc(result.returnPct)}
                      </span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        buy &amp; hold {fmtPctc(result.buyHoldPct)}
                      </span>
                    </p>
                  </div>
                  <EquityCurve equity={result.equity} capital={capital} />
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <Metric
                    label="Strategy return"
                    value={fmtPctc(result.returnPct)}
                    tone={result.returnPct >= 0 ? "bull" : "bear"}
                  />
                  <Metric label="Alpha vs hold" value={fmtPctc(result.returnPct - result.buyHoldPct)} />
                  <Metric label="Win rate" value={`${result.winRate.toFixed(1)}%`} />
                  <Metric
                    label="Profit factor"
                    value={Number.isFinite(result.profitFactor) ? result.profitFactor.toFixed(2) : "∞"}
                  />
                  <Metric label="Max drawdown" value={`-${result.maxDrawdownPct.toFixed(1)}%`} tone="bear" />
                  <Metric label="Trades" value={String(result.trades.length)} />
                  <Metric label="Avg trade" value={fmtPctc(result.avgTradePct)} />
                  <Metric label="Time in market" value={`${result.exposurePct.toFixed(0)}%`} />
                  <Metric label="Best trade" value={fmtPctc(result.bestPct)} tone="bull" />
                  <Metric label="Worst trade" value={fmtPctc(result.worstPct)} tone="bear" />
                  <Metric label="Final equity" value={fmtUsdc(result.finalEquity)} />
                  <Metric label="Start capital" value={fmtUsdc(capital)} />
                </div>

                <div className="panel overflow-hidden">
                  <p className="border-b border-border/70 px-4 py-3 text-xs font-medium">Trade journal</p>
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="text-[10px] tracking-wide text-muted-foreground uppercase">
                        <tr className="border-b border-border/70">
                          <th className="px-4 py-2 text-left">#</th>
                          <th className="px-4 py-2 text-left">Entry</th>
                          <th className="px-4 py-2 text-left">Exit</th>
                          <th className="px-4 py-2 text-right">In</th>
                          <th className="px-4 py-2 text-right">Out</th>
                          <th className="px-4 py-2 text-right">P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                              No trades triggered for these parameters.
                            </td>
                          </tr>
                        )}
                        {result.trades.map((t, i) => (
                          <tr key={`${t.entryTime}-${i}`} className="border-b border-border/40">
                            <td className="num px-4 py-2">{i + 1}</td>
                            <td className="num px-4 py-2">{new Date(t.entryTime).toLocaleDateString("en-US")}</td>
                            <td className="num px-4 py-2">{new Date(t.exitTime).toLocaleDateString("en-US")}</td>
                            <td className="num px-4 py-2 text-right">{fmtUsdc(t.entry)}</td>
                            <td className="num px-4 py-2 text-right">{fmtUsdc(t.exit)}</td>
                            <td
                              className={`num px-4 py-2 text-right ${t.pnl >= 0 ? "text-bull" : "text-bear"}`}
                            >
                              {fmtPctc(t.pnlPct)} · {fmtUsdc(t.pnl)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
