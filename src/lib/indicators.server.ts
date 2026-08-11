/** Shared technical indicator math (server only). */

import type { Bar } from "@/lib/futures.server";

export type Indicators = {
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  vwap: number;
  ema20: number;
  ema50: number;
  atrPct: number;
  verdict: "buy" | "sell" | "hold";
  score: number;
};

function emaSeries(values: number[], span: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (span + 1);
  const out: number[] = [values[0] as number];
  for (let i = 1; i < values.length; i++) out.push((values[i] as number) * k + (out[i - 1] as number) * (1 - k));
  return out;
}

function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const d = (values[i] as number) - (values[i - 1] as number);
    if (d >= 0) gain += d;
    else loss -= d;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
}

export function indicators(bars: Bar[]): Indicators {
  const closes = bars.map((b) => b.close);
  const last = closes.at(-1) ?? 0;
  if (closes.length < 5) {
    return {
      rsi14: 50,
      macd: 0,
      macdSignal: 0,
      macdHist: 0,
      vwap: last,
      ema20: last,
      ema50: last,
      atrPct: 0,
      verdict: "hold",
      score: 50,
    };
  }

  const fast = emaSeries(closes, 12);
  const slow = emaSeries(closes, 26);
  const macdLine = closes.map((_, i) => (fast[i] as number) - (slow[i] as number));
  const signalLine = emaSeries(macdLine, 9);
  const macd = macdLine.at(-1) as number;
  const macdSignal = signalLine.at(-1) as number;
  const macdHist = macd - macdSignal;

  const pv = bars.reduce((s, b) => s + ((b.high + b.low + b.close) / 3) * (b.volume || 1), 0);
  const vol = bars.reduce((s, b) => s + (b.volume || 1), 0);
  const vwap = vol > 0 ? pv / vol : last;

  const ema20 = emaSeries(closes, 20).at(-1) as number;
  const ema50 = emaSeries(closes, 50).at(-1) as number;
  const rsi14 = rsi(closes);
  const atrPct =
    (bars.slice(-40).reduce((s, b) => s + (b.high - b.low), 0) / Math.min(40, bars.length) / (last || 1)) * 100;

  let score = 50;
  score += Math.max(-18, Math.min(18, (macdHist / (last || 1)) * 4200));
  score += Math.max(-14, Math.min(14, (rsi14 - 50) * 0.45));
  score += last > vwap ? 9 : -9;
  score += ema20 > ema50 ? 9 : -9;
  score = Math.max(2, Math.min(98, Math.round(score)));

  return {
    rsi14,
    macd,
    macdSignal,
    macdHist,
    vwap,
    ema20,
    ema50,
    atrPct,
    verdict: score >= 62 ? "buy" : score <= 38 ? "sell" : "hold",
    score,
  };
}
