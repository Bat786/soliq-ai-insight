/**
 * SOLIQ probabilistic price projections (client-safe pure math).
 *
 * One model for every desk — stocks, ETFs, futures, commodities, forex and
 * major crypto. It consumes the SAME series and composite score the existing
 * SOLIQ analytics already produce, and returns bull / base / bear paths with an
 * expected range and a confidence that decays with horizon.
 *
 * Memecoins are deliberately excluded: `projectSeries` refuses to project when
 * `projectable` is false, so callers can gate by classification in one place.
 */

export type ProjectionHorizon = "intraday" | "1D" | "3D" | "1W" | "2W" | "1M" | "3M" | "6M" | "1Y";

export type ProjectionCase = {
  /** Model price at the horizon. */
  price: number;
  /** Percent change from the current price. */
  changePct: number;
};

export type Projection = {
  horizon: ProjectionHorizon;
  label: string;
  /** Calendar days ahead. */
  days: number;
  base: ProjectionCase;
  bull: ProjectionCase;
  bear: ProjectionCase;
  /** ~80% expected range. */
  low: number;
  high: number;
  direction: "up" | "down" | "flat";
  /** 0-100. Falls off with horizon and with a weaker composite score. */
  confidence: number;
};

export type ProjectionSet = {
  current: number;
  asOf: number;
  model: string;
  /** Trailing sample the model was fitted on, in calendar days. */
  sampleDays: number;
  /** Annualized volatility of the fitted sample, in percent. */
  volatilityPct: number;
  /** Which analytics drove the tilt. */
  drivers: string[];
  horizons: Projection[];
  disclaimer: string;
};

const HORIZONS: { horizon: ProjectionHorizon; label: string; days: number }[] = [
  { horizon: "intraday", label: "Intraday", days: 0.35 },
  { horizon: "1D", label: "1 day", days: 1 },
  { horizon: "3D", label: "3 days", days: 3 },
  { horizon: "1W", label: "1 week", days: 7 },
  { horizon: "2W", label: "2 weeks", days: 14 },
  { horizon: "1M", label: "1 month", days: 30 },
  { horizon: "3M", label: "3 months", days: 91 },
  { horizon: "6M", label: "6 months", days: 182 },
  { horizon: "1Y", label: "1 year", days: 365 },
];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Median spacing of the series, in ms. Falls back to one day. */
function stepMs(timestamps: number[] | undefined, points: number): number {
  if (!timestamps || timestamps.length < 3) return 86_400_000;
  const diffs = timestamps
    .slice(1)
    .map((t, i) => t - (timestamps[i] as number))
    .filter((d) => d > 0)
    .sort((a, b) => a - b);
  const mid = diffs[Math.floor(diffs.length / 2)];
  if (!mid || !Number.isFinite(mid)) return 86_400_000;
  // Guard against a series whose stamps are seconds, not ms.
  void points;
  return mid;
}

const round = (n: number) => {
  if (!Number.isFinite(n)) return 0;
  const abs = Math.abs(n);
  if (abs >= 1000) return Number(n.toFixed(2));
  if (abs >= 1) return Number(n.toFixed(4));
  return Number(n.toPrecision(6));
};

export type ProjectionInput = {
  /** Close series, oldest → newest. */
  closes: number[];
  /** Optional matching timestamps (ms) so the model knows the bar spacing. */
  timestamps?: number[];
  /** Composite SOLIQ score, 0-100 (bullish above 50). */
  score: number;
  /** Trend strength / ADX-like 0-100, when the caller has one. */
  trendStrength?: number;
  /** Names of the signals that justify the tilt (shown in the UI). */
  drivers?: string[];
  /** False for memecoins — no projection is produced. */
  projectable: boolean;
  /** Overrides the last close when a live quote is fresher. */
  current?: number;
};

/**
 * Trend + mean-reversion drift with a score-weighted tilt, and lognormal
 * volatility bands scaled by √time. Returns `null` when the asset is not
 * projectable or the series is too thin to fit.
 */
export function projectSeries(input: ProjectionInput): ProjectionSet | null {
  if (!input.projectable) return null;
  const closes = input.closes.filter((c) => Number.isFinite(c) && c > 0);
  if (closes.length < 12) return null;

  const last = input.current && input.current > 0 ? input.current : (closes.at(-1) as number);
  const step = stepMs(input.timestamps, closes.length);
  const barsPerDay = clamp(86_400_000 / step, 1 / 30, 480);

  // Log returns of the fitted window.
  const window = closes.slice(-320);
  const rets = window
    .slice(1)
    .map((c, i) => Math.log(c / (window[i] as number)))
    .filter((r) => Number.isFinite(r));
  if (rets.length < 8) return null;

  const sigmaBar = stdev(rets) || Math.abs(mean(rets)) || 0.005;
  const driftBar = mean(rets.slice(-Math.max(20, Math.floor(rets.length * 0.6))));
  const sma = mean(window.slice(-20));
  const reversionPull = sma > 0 ? (sma - last) / last : 0;

  const bias = clamp((input.score - 50) / 50, -1, 1);
  const trend = clamp((input.trendStrength ?? 50) / 100, 0, 1);
  const sampleDays = Math.max(1, Math.round((rets.length / barsPerDay) * 10) / 10);
  const sigmaDay = sigmaBar * Math.sqrt(barsPerDay);

  const horizons: Projection[] = HORIZONS.map(({ horizon, label, days }) => {
    const steps = Math.max(1, days * barsPerDay);
    // Drift is damped with horizon: a 5-minute slope must not compound into a year.
    const decay = 1 / (1 + 0.35 * Math.sqrt(days));
    const driftTerm = driftBar * steps * decay * (0.55 + trend * 0.45);
    const reversionTerm = reversionPull * clamp(0.12 * Math.sqrt(days), 0.02, 0.55);
    const tilt = bias * sigmaBar * Math.sqrt(steps) * 0.45;

    const base = last * Math.exp(driftTerm + reversionTerm + tilt);
    const band = sigmaBar * Math.sqrt(steps);
    const bull = base * Math.exp(band);
    const bear = base * Math.exp(-band);
    const high = base * Math.exp(band * 1.28);
    const low = base * Math.exp(-band * 1.28);

    const changePct = ((base - last) / last) * 100;
    const conf = clamp(
      46 + Math.abs(bias) * 26 + trend * 16 - Math.sqrt(days) * 2.4 - clamp(sigmaDay * 100, 0, 18),
      12,
      93,
    );

    const mk = (price: number): ProjectionCase => ({
      price: round(price),
      changePct: Number((((price - last) / last) * 100).toFixed(2)),
    });

    return {
      horizon,
      label,
      days,
      base: mk(base),
      bull: mk(bull),
      bear: mk(bear),
      low: round(Math.max(0, low)),
      high: round(high),
      direction: changePct > 0.35 ? "up" : changePct < -0.35 ? "down" : "flat",
      confidence: Number(conf.toFixed(0)),
    };
  });

  return {
    current: round(last),
    asOf: Date.now(),
    model: "SOLIQ trend + mean-reversion with lognormal volatility bands",
    sampleDays,
    volatilityPct: Number((sigmaDay * Math.sqrt(365) * 100).toFixed(1)),
    drivers: (input.drivers ?? []).slice(0, 6),
    horizons,
    disclaimer:
      "Model-based probabilistic projections from SOLIQ analytics — not guaranteed prices and not financial advice.",
  };
}

/** Memecoins never get projections; every other supported kind does. */
export function isProjectableKind(kind: string | null | undefined): boolean {
  const k = (kind ?? "").toLowerCase();
  return !(k === "memecoin" || k === "meme");
}
