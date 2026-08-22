/**
 * Universal symbol dashboard loader — server only.
 *
 * One call assembles everything a day trader needs for a single ticker, token,
 * pair, index or futures contract: bars at the requested timeframe, indicators,
 * price-action levels, volume momentum, news, and (for equities) the balance
 * sheet, float and short-interest mechanics. Every slice degrades instead of
 * throwing so a missing entitlement never blanks the page.
 */

import { contracts, resample, type Bar } from "@/lib/futures.server";
import { indicators, type Indicators } from "@/lib/indicators.server";
import { projectSeries, type ProjectionSet } from "@/lib/projections";
import { massiveCustomBars, massiveNews, type AssetClass, type MassiveNews } from "@/lib/massive.server";
import { loadBars } from "@/lib/tape.server";
import { tfSpec, type DeskTf, type SymbolMarket } from "@/lib/timeframes";

export type PriceAction = {
  last: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  changePct: number;
  changeAbs: number;
  rangePct: number;
  gapPct: number;
  vwapDist: number;
  sessionHigh: number;
  sessionLow: number;
  support: number;
  resistance: number;
  atr: number;
  trend: "up" | "down" | "flat";
};

export type VolumeMomentum = {
  volume: number;
  avgVolume: number;
  relVolume: number;
  volumeTrend: "surging" | "elevated" | "normal" | "dry";
  upBars: number;
  downBars: number;
  netFlowPct: number;
  momentum5: number;
  momentum20: number;
};

export type SymbolFundamentals = {
  name: string | null;
  description: string | null;
  exchange: string | null;
  sector: string | null;
  employees: number | null;
  marketCap: number | null;
  shares: number | null;
  logo: string | null;
  homepage: string | null;
  listDate: string | null;
  quarterly: {
    period: string;
    fiscalYear: string;
    end: string;
    revenue: number | null;
    netIncome: number | null;
    grossProfit: number | null;
    operatingIncome: number | null;
    eps: number | null;
    assets: number | null;
    liabilities: number | null;
    equity: number | null;
    cashFlow: number | null;
  }[];
  annual: SymbolFundamentals["quarterly"];
  shortInterest: {
    settlementDate: string;
    shortVolume: number | null;
    shortInterest: number | null;
    daysToCover: number | null;
    avgDailyVolume: number | null;
  }[];
  float: {
    shares: number | null;
    float: number | null;
    freeFloatPct: number | null;
    shortPctFloat: number | null;
    daysToCover: number | null;
    marketCap: number | null;
  } | null;
  options: {
    putCallRatio: number | null;
    callVolume: number;
    putVolume: number;
    callOi: number;
    putOi: number;
    available: boolean;
  } | null;
};

export type SymbolDashboard = {
  market: SymbolMarket;
  symbol: string;
  display: string;
  timeframe: DeskTf;
  source: "massive" | "twelvedata" | "tape" | "none";
  bars: Bar[];
  action: PriceAction | null;
  indicators: Indicators | null;
  volume: VolumeMomentum | null;
  levels: { label: string; value: number }[];
  news: MassiveNews[];
  fundamentals: SymbolFundamentals | null;
  /** Probabilistic projection set; `null` when the series is too thin. */
  projection: ProjectionSet | null;
  notes: string[];
  updatedAt: number;
};

const assetClassFor = (market: SymbolMarket): AssetClass =>
  market === "crypto" ? "crypto" : market === "fx" ? "fx" : market === "indices" ? "indices" : "stocks";

/** Resolve the symbol we actually query upstream, per market convention. */
function resolve(market: SymbolMarket, raw: string) {
  const s = raw.trim().toUpperCase();
  if (market === "futures") {
    const c = contracts.find((x) => x.code === s.replace(/[^A-Z]/g, ""));
    return {
      upstream: c?.proxy ?? s,
      yahoo: c?.proxy ?? s,
      display: c ? `${c.code} · ${c.name}` : s,
      proxy: c ? `${c.proxy} ETF proxy` : null,
    };
  }
  if (market === "crypto") {
    const base = s.replace(/[-/]/g, "").replace(/USDT?$/, "");
    return { upstream: `${base}USD`, yahoo: `${base}-USD`, display: `${base}/USD`, proxy: null };
  }
  if (market === "fx") {
    const pair = s.replace(/[-/=X]/g, "");
    return { upstream: pair, yahoo: `${pair}=X`, display: `${pair.slice(0, 3)}/${pair.slice(3)}`, proxy: null };
  }
  if (market === "indices") {
    const idx = s.replace(/^[I:^]+/, "");
    return { upstream: idx, yahoo: `^${idx}`, display: idx, proxy: null };
  }
  return { upstream: s, yahoo: s, display: s, proxy: null };
}

async function loadSeries(market: SymbolMarket, up: string, yahoo: string, tf: DeskTf) {
  const spec = tfSpec(tf);
  const primary = await massiveCustomBars(assetClassFor(market), up, tf).catch(() => null);
  if (primary && primary.length > 8) return { bars: primary, source: "massive" as const };

  // Twelve Data sits between Massive and the backup tape: it covers equities,
  // ETFs, FX, commodities and crypto, and returns null whenever its plan does
  // not, so the tape still gets its turn.
  const { tdInterval, tdSymbol, twelveDataBars } = await import("@/lib/twelvedata.server");
  const tdMarket = market === "crypto" ? "crypto" : market === "fx" ? "fx" : "stocks";
  const td = await twelveDataBars(tdSymbol(tdMarket, up), tdInterval(tf), 400).catch(() => null);
  if (td && td.length > 8) {
    const bars = spec.ms > 86_400_000 ? resample(td, spec.ms) : td;
    return { bars, source: "twelvedata" as const };
  }

  const fallback = await loadBars(yahoo, { interval: spec.yahoo.interval, range: spec.yahoo.range }).catch(() => []);
  if (fallback.length > 4) {
    const baseMs = spec.yahoo.interval.endsWith("m")
      ? Number(spec.yahoo.interval.replace("m", "")) * 60_000
      : spec.yahoo.interval === "60m"
        ? 3_600_000
        : 86_400_000;
    const bars = spec.ms > baseMs ? resample(fallback, spec.ms) : fallback;
    return { bars, source: "tape" as const };
  }
  return { bars: [] as Bar[], source: "none" as const };
}


function priceAction(bars: Bar[], spec: { ms: number }): PriceAction {
  const last = bars.at(-1) as Bar;
  const perDay = Math.max(1, Math.round(86_400_000 / spec.ms));
  const session = bars.slice(-perDay);
  const prior = bars.slice(-2 * perDay, -perDay);
  const prevClose = prior.at(-1)?.close ?? bars.at(-2)?.close ?? last.close;
  const open = session[0]?.open ?? last.open;
  const high = Math.max(...session.map((b) => b.high));
  const low = Math.min(...session.map((b) => b.low));
  const window = bars.slice(-60);
  const tr = window.slice(1).map((b, i) => Math.max(b.high - b.low, Math.abs(b.high - (window[i] as Bar).close)));
  const atr = tr.length ? tr.reduce((s, v) => s + v, 0) / tr.length : 0;
  let pv = 0;
  let vv = 0;
  for (const b of session) {
    const v = b.volume > 0 ? b.volume : 1;
    pv += ((b.high + b.low + b.close) / 3) * v;
    vv += v;
  }
  const vwap = vv > 0 ? pv / vv : last.close;
  const closes = window.map((b) => b.close);
  const first = closes[0] ?? last.close;
  return {
    last: last.close,
    open,
    high,
    low,
    prevClose,
    changePct: prevClose > 0 ? Number((((last.close - prevClose) / prevClose) * 100).toFixed(2)) : 0,
    changeAbs: Number((last.close - prevClose).toFixed(6)),
    rangePct: low > 0 ? Number((((high - low) / low) * 100).toFixed(2)) : 0,
    gapPct: prevClose > 0 ? Number((((open - prevClose) / prevClose) * 100).toFixed(2)) : 0,
    vwapDist: vwap > 0 ? Number((((last.close - vwap) / vwap) * 100).toFixed(2)) : 0,
    sessionHigh: high,
    sessionLow: low,
    support: Math.min(...window.map((b) => b.low)),
    resistance: Math.max(...window.map((b) => b.high)),
    atr: Number(atr.toFixed(6)),
    trend: last.close > first * 1.002 ? "up" : last.close < first * 0.998 ? "down" : "flat",
  };
}

function volumeMomentum(bars: Bar[]): VolumeMomentum {
  const last = bars.at(-1) as Bar;
  const win = bars.slice(-21, -1);
  const avg = win.length ? win.reduce((s, b) => s + b.volume, 0) / win.length : 0;
  const rel = avg > 0 ? Number((last.volume / avg).toFixed(2)) : 0;
  const recent = bars.slice(-20);
  const upBars = recent.filter((b) => b.close >= b.open).length;
  const upVol = recent.filter((b) => b.close >= b.open).reduce((s, b) => s + b.volume, 0);
  const total = recent.reduce((s, b) => s + b.volume, 0);
  const px = (n: number) => bars.at(-1 - n)?.close ?? last.close;
  return {
    volume: last.volume,
    avgVolume: Math.round(avg),
    relVolume: rel,
    volumeTrend: rel >= 3 ? "surging" : rel >= 1.5 ? "elevated" : rel >= 0.6 ? "normal" : "dry",
    upBars,
    downBars: recent.length - upBars,
    netFlowPct: total > 0 ? Number(((upVol / total) * 100).toFixed(1)) : 50,
    momentum5: px(5) > 0 ? Number((((last.close - px(5)) / px(5)) * 100).toFixed(2)) : 0,
    momentum20: px(20) > 0 ? Number((((last.close - px(20)) / px(20)) * 100).toFixed(2)) : 0,
  };
}

async function equityFundamentals(ticker: string): Promise<SymbolFundamentals | null> {
  const { loadProfile, loadFinancials, loadShortInterest, loadFloatStats, loadOptionsChain } = await import(
    "@/lib/equity.server"
  );
  const [profile, quarterly, annual, shortInterest, float, options] = await Promise.all([
    loadProfile(ticker).catch(() => null),
    loadFinancials(ticker, "quarterly").catch(() => []),
    loadFinancials(ticker, "annual").catch(() => []),
    loadShortInterest(ticker).catch(() => []),
    loadFloatStats(ticker).catch(() => null),
    loadOptionsChain(ticker).catch(() => null),
  ]);
  if (!profile && !quarterly.length && !annual.length) return null;
  return {
    name: profile?.name ?? null,
    description: profile?.description ?? null,
    exchange: profile?.exchange ?? null,
    sector: profile?.sic ?? null,
    employees: profile?.employees ?? null,
    marketCap: profile?.marketCap ?? null,
    shares: profile?.shares ?? null,
    logo: profile?.logo ?? null,
    homepage: profile?.homepage ?? null,
    listDate: profile?.listDate ?? null,
    quarterly,
    annual,
    shortInterest,
    float,
    options: options
      ? {
          putCallRatio: options.putCallRatio,
          callVolume: options.callVolume,
          putVolume: options.putVolume,
          callOi: options.callOi,
          putOi: options.putOi,
          available: options.available,
        }
      : null,
  };
}

export async function loadSymbolDashboard(
  market: SymbolMarket,
  symbolRaw: string,
  tf: DeskTf,
): Promise<SymbolDashboard> {
  const spec = tfSpec(tf);
  const { upstream, yahoo, display, proxy } = resolve(market, symbolRaw);
  const notes: string[] = [];
  if (proxy) notes.push(`Continuous futures pricing tracked through its liquid ${proxy}.`);

  const [{ bars, source }, news, fundamentals] = await Promise.all([
    loadSeries(market, upstream, yahoo, tf),
    massiveNews(market === "stocks" ? upstream : undefined, 12).catch(() => [] as MassiveNews[]),
    market === "stocks" || market === "futures" ? equityFundamentals(upstream).catch(() => null) : Promise.resolve(null),
  ]);

  if (source === "none") notes.push("No bar feed answered for this symbol at the selected timeframe yet.");
  if (source === "twelvedata") notes.push("Bars served by Twelve Data (Massive not entitled for this slice).");
  if (source === "tape") notes.push("Bars served from the backup tape (primary feed not entitled for this slice).");
  if (!fundamentals && (market === "stocks" || market === "futures"))
    notes.push("Filed fundamentals are not available for this symbol on the current data plan.");

  const enough = bars.length > 8;
  const ind = enough ? indicators(bars) : null;
  const action = enough ? priceAction(bars, spec) : null;
  const vol = enough ? volumeMomentum(bars) : null;

  // Composite score fed into the shared projection engine — the same trend,
  // momentum and volume evidence the rest of SOLIQ scores on.
  const score = (() => {
    if (!ind || !action) return 50;
    let s = 50;
    s += Math.max(-14, Math.min(14, (action.changePct ?? 0) * 1.2));
    s += ind.rsi14 > 55 ? 6 : ind.rsi14 < 45 ? -6 : 0;
    s += ind.macdHist > 0 ? 6 : -6;
    s += action.last > ind.ema50 ? 6 : -6;
    s += (vol?.relVolume ?? 1) > 1.2 ? 4 : 0;
    return Math.max(0, Math.min(100, s));
  })();

  const projection = enough
    ? projectSeries({
        closes: bars.map((b) => b.close),
        timestamps: bars.map((b) => b.t),
        ...(action ? { current: action.last } : {}),
        score,
        trendStrength: ind ? Math.min(100, Math.abs(ind.macdHist / Math.max(1e-9, ind.ema50)) * 4000 + 40) : 50,
        projectable: true,
        drivers: [
          ind ? `RSI ${ind.rsi14.toFixed(0)}` : "",
          ind ? `EMA50 ${ind.ema50 > 0 ? ind.ema50.toFixed(2) : "—"}` : "",
          ind ? (ind.macdHist > 0 ? "MACD bullish" : "MACD bearish") : "",
          vol ? `rel volume ${vol.relVolume.toFixed(2)}x` : "",
          action ? `${action.changePct >= 0 ? "up" : "down"} ${Math.abs(action.changePct).toFixed(2)}% on session` : "",
        ].filter(Boolean),
      })
    : null;

  return {
    market,
    symbol: upstream,
    display,
    timeframe: tf,
    source,
    bars,
    action,
    indicators: ind,
    volume: vol,
    levels: enough
      ? (() => {
          const a = priceAction(bars, spec);
          const pivot = (a.sessionHigh + a.sessionLow + a.last) / 3;
          return [
            { label: "R2", value: pivot + (a.sessionHigh - a.sessionLow) },
            { label: "R1", value: 2 * pivot - a.sessionLow },
            { label: "Pivot", value: pivot },
            { label: "S1", value: 2 * pivot - a.sessionHigh },
            { label: "S2", value: pivot - (a.sessionHigh - a.sessionLow) },
          ].map((l) => ({ label: l.label, value: Number(l.value.toFixed(4)) }));
        })()
      : [],
    news,
    fundamentals,
    projection,
    notes,
    updatedAt: Date.now(),
  };
}
