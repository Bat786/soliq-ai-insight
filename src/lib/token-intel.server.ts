/**
 * Token intelligence for one on-chain asset (server only).
 *
 * Reuses the providers SOLIQ already calls — Jupiter (identity, organic flow,
 * audit), DexScreener (pair liquidity, txn counts) and GeckoTerminal (pool
 * OHLCV) — and runs the bars through the shared indicator math. Nothing is
 * fabricated: every block returns null when its provider has no data.
 */

import { indicators, type Indicators } from "@/lib/indicators.server";
import { jupiterTokenSearch, searchPairs, type DexPair, type TokenRow } from "@/lib/dex.server";
import { gtPoolOhlcv } from "@/lib/coingecko.server";
import type { Bar } from "@/lib/futures.server";

export type TokenIntelTf = "5m" | "15m" | "1h" | "4h" | "1d";

const GT_TF: Record<TokenIntelTf, { tf: "minute" | "hour" | "day"; aggregate: number }> = {
  "5m": { tf: "minute", aggregate: 5 },
  "15m": { tf: "minute", aggregate: 15 },
  "1h": { tf: "hour", aggregate: 1 },
  "4h": { tf: "hour", aggregate: 4 },
  "1d": { tf: "day", aggregate: 1 },
};

export type TokenLevels = {
  support: number;
  resistance: number;
  bbUpper: number;
  bbLower: number;
  bbMid: number;
  volatilityPct: number;
  /** 0-100: how compressed the range is versus its own history. */
  breakoutPotential: number;
};

export type TokenIntel = {
  mint: string;
  timeframe: TokenIntelTf;
  token: TokenRow | null;
  pair: DexPair | null;
  bars: Bar[];
  indicators: Indicators | null;
  levels: TokenLevels | null;
  notes: string[];
  updatedAt: number;
};

function levelsFrom(bars: Bar[]): TokenLevels | null {
  if (bars.length < 20) return null;
  const window = bars.slice(-60);
  const closes = window.map((b) => b.close);
  const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
  const variance = closes.reduce((a, b) => a + (b - mean) ** 2, 0) / closes.length;
  const sd = Math.sqrt(variance);
  const highs = window.map((b) => b.high);
  const lows = window.map((b) => b.low);
  const resistance = Math.max(...highs);
  const support = Math.min(...lows);
  const range = resistance - support;
  const recent = window.slice(-12);
  const recentRange = Math.max(...recent.map((b) => b.high)) - Math.min(...recent.map((b) => b.low));
  const compression = range > 0 ? 1 - Math.min(1, recentRange / range) : 0;
  return {
    support,
    resistance,
    bbUpper: mean + 2 * sd,
    bbLower: mean - 2 * sd,
    bbMid: mean,
    volatilityPct: mean > 0 ? Number(((sd / mean) * 100).toFixed(2)) : 0,
    breakoutPotential: Math.round(compression * 100),
  };
}

export async function loadTokenIntel(mint: string, timeframe: TokenIntelTf = "1h"): Promise<TokenIntel> {
  const notes: string[] = [];
  const spec = GT_TF[timeframe];

  const [tokens, pairs] = await Promise.all([
    jupiterTokenSearch(mint).catch(() => [] as TokenRow[]),
    searchPairs(mint).catch(() => [] as DexPair[]),
  ]);

  const token = tokens.find((t) => t.mint === mint) ?? tokens[0] ?? null;
  const pair = pairs.find((p) => p.chainId === "solana") ?? pairs[0] ?? null;
  if (!token) notes.push("Jupiter has no record for this mint — on-chain flow analytics are unavailable.");
  if (!pair) notes.push("DexScreener lists no pair for this mint — liquidity and trade counts are unavailable.");

  let bars: Bar[] = [];
  if (pair) {
    bars = await gtPoolOhlcv(pair.pairAddress, spec.tf, spec.aggregate).catch(() => [] as Bar[]);
    if (!bars.length) notes.push("No pool OHLCV published for this pair yet — chart and indicators will appear once it trades.");
  }

  return {
    mint,
    timeframe,
    token,
    pair,
    bars,
    indicators: bars.length >= 30 ? indicators(bars) : null,
    levels: levelsFrom(bars),
    notes,
    updatedAt: Date.now(),
  };
}
