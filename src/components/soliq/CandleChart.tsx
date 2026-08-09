import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";

export type Point = { t: number; p: number };
export type VolPoint = { t: number; v: number };

export type Candle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const intervals = [
  { id: "1m", label: "1m", ms: 60_000 },
  { id: "5m", label: "5m", ms: 5 * 60_000 },
  { id: "15m", label: "15m", ms: 15 * 60_000 },
  { id: "1h", label: "1H", ms: 3_600_000 },
  { id: "4h", label: "4H", ms: 4 * 3_600_000 },
  { id: "1d", label: "1D", ms: 86_400_000 },
  { id: "1w", label: "1W", ms: 7 * 86_400_000 },
  { id: "1M", label: "1M", ms: 30 * 86_400_000 },
] as const;

export type IntervalId = (typeof intervals)[number]["id"];

export function bucketMs(id: IntervalId) {
  return intervals.find((i) => i.id === id)?.ms ?? 86_400_000;
}

/**
 * Aggregate a price series into OHLC candles at the requested interval.
 * Volume is bucketed on the same grid so histogram bars always line up with
 * their candle instead of being matched by array index.
 */
export function toCandles(points: Point[], interval: IntervalId, volumes?: VolPoint[]): Candle[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const size = bucketMs(interval);

  const volByBucket = new Map<number, number>();
  for (const { t, v } of volumes ?? []) {
    const key = Math.floor(t / size) * size;
    volByBucket.set(key, (volByBucket.get(key) ?? 0) + v);
  }

  const byBucket = new Map<number, Candle>();
  for (const { t, p } of sorted) {
    if (!Number.isFinite(p)) continue;
    const key = Math.floor(t / size) * size;
    const existing = byBucket.get(key);
    if (!existing) {
      byBucket.set(key, {
        time: (key / 1000) as UTCTimestamp,
        open: p,
        high: p,
        low: p,
        close: p,
        volume: volByBucket.get(key) ?? 0,
      });
    } else {
      existing.high = Math.max(existing.high, p);
      existing.low = Math.min(existing.low, p);
      existing.close = p;
    }
  }
  return [...byBucket.values()].sort((a, b) => (a.time as number) - (b.time as number));
}

/**
 * Pick the finest interval that still produces a usable number of candles for
 * the data we actually have — prevents a blank pane when the provider returns
 * coarser data than the selected interval.
 */
export function resolveInterval(points: Point[], requested: IntervalId, min = 8): IntervalId {
  if (points.length === 0) return requested;
  const span = (points[points.length - 1]?.t ?? 0) - (points[0]?.t ?? 0);
  if (span <= 0) return requested;
  const order = intervals.map((i) => i.id);
  const start = Math.max(0, order.indexOf(requested));
  for (let i = start; i >= 0; i--) {
    const id = order[i] as IntervalId;
    if (span / bucketMs(id) >= min) return id;
  }
  return order[0] as IntervalId;
}

function sma(values: number[], period: number) {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

function rsiSeries(values: number[], period = 14) {
  const out: (number | null)[] = [null];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const diff = values[i]! - values[i - 1]!;
    const g = Math.max(0, diff);
    const l = Math.max(0, -diff);
    if (i <= period) {
      gain += g;
      loss += l;
      out.push(i === period ? 100 - 100 / (1 + gain / period / Math.max(1e-9, loss / period)) : null);
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      out.push(100 - 100 / (1 + gain / Math.max(1e-9, loss)));
    }
  }
  return out;
}

/**
 * lightweight-charts cannot parse oklch(), so chart colours are hex literals
 * mirroring the design tokens for each theme.
 */
const palettes = {
  dark: {
    bg: "#0b0b14",
    text: "#9a97b8",
    grid: "rgba(150,150,190,0.12)",
    bull: "#14f195",
    bear: "#ff5470",
    primary: "#9945ff",
    warn: "#f5c542",
    info: "#4ea8ff",
  },
  light: {
    bg: "#ffffff",
    text: "#5d5a75",
    grid: "rgba(90,80,130,0.14)",
    bull: "#0fa876",
    bear: "#e0344f",
    primary: "#7b2ff7",
    warn: "#c98b12",
    info: "#2b7fd4",
  },
} as const;

function palette() {
  const light = typeof document !== "undefined" && document.documentElement.classList.contains("light");
  return light ? palettes.light : palettes.dark;
}

export type Overlays = { ma20: boolean; ma50: boolean; vwap: boolean; rsi: boolean; volume: boolean; signals: boolean };

export default function CandleChart({
  points,
  volumes,
  interval,
  overlays,
  height = 420,
  onHover,
}: {
  points: Point[];
  volumes?: VolPoint[] | undefined;
  interval: IntervalId;
  overlays: Overlays;
  height?: number | undefined;
  onHover?: ((c: Candle | null) => void) | undefined;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const hoverRef = useRef(onHover);
  hoverRef.current = onHover;
  const [themeKey, setThemeKey] = useState(0);

  const effective = useMemo(() => resolveInterval(points, interval), [points, interval]);
  const candles = useMemo(() => toCandles(points, effective, volumes), [points, effective, volumes]);

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeKey((k) => k + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = holder.current;
    if (!el || candles.length === 0) return;

    const { bg, text, grid, bull, bear, primary, warn, info } = palette();

    const chart = createChart(el, {
      width: el.clientWidth || 600,
      height,
      layout: {
        background: { color: bg },
        textColor: text,
        fontFamily: "JetBrains Mono, monospace",
        attributionLogo: false,
        panes: { separatorColor: grid, separatorHoverColor: grid },
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, timeVisible: true, secondsVisible: false, rightOffset: 4 },
      handleScroll: true,
      handleScale: true,
      crosshair: {
        mode: 0,
        vertLine: { color: primary, width: 1, style: 2, labelBackgroundColor: primary },
        horzLine: { color: primary, width: 1, style: 2, labelBackgroundColor: primary },
      },
    });
    chartRef.current = chart;

    // Hollow candles: transparent bodies, coloured borders/wicks.
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "rgba(0,0,0,0)",
      downColor: bear,
      borderUpColor: bull,
      borderDownColor: bear,
      wickUpColor: bull,
      wickDownColor: bear,
    });
    candleSeries.setData(candles);

    const closes = candles.map((c) => c.close);

    if (overlays.ma20) {
      const s = chart.addSeries(LineSeries, { color: primary, lineWidth: 2, priceLineVisible: false, title: "MA20" });
      s.setData(
        sma(closes, 20)
          .map((v, i) => (v === null ? null : { time: candles[i]!.time, value: v }))
          .filter(Boolean) as { time: UTCTimestamp; value: number }[],
      );
    }
    if (overlays.ma50) {
      const s = chart.addSeries(LineSeries, { color: warn, lineWidth: 2, priceLineVisible: false, title: "MA50" });
      s.setData(
        sma(closes, 50)
          .map((v, i) => (v === null ? null : { time: candles[i]!.time, value: v }))
          .filter(Boolean) as { time: UTCTimestamp; value: number }[],
      );
    }
    if (overlays.vwap) {
      const s = chart.addSeries(LineSeries, {
        color: info,
        lineWidth: 2,
        lineStyle: 2,
        priceLineVisible: false,
        title: "VWAP",
      });
      let pv = 0;
      let vv = 0;
      const data = candles.map((c) => {
        const typical = (c.high + c.low + c.close) / 3;
        const vol = c.volume > 0 ? c.volume : 1;
        pv += typical * vol;
        vv += vol;
        return { time: c.time, value: pv / Math.max(1e-9, vv) };
      });
      s.setData(data);
    }

    if (overlays.volume) {
      const vol = chart.addSeries(
        HistogramSeries,
        { priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false },
        1,
      );
      vol.setData(
        candles.map((c) => ({
          time: c.time,
          value: c.volume > 0 ? c.volume : Math.abs(c.close - c.open) * 1000,
          color: c.close >= c.open ? `${bull}66` : `${bear}66`,
        })),
      );
      chart.panes()[1]?.setHeight(Math.round(height * 0.18));
    }

    if (overlays.rsi) {
      const paneIndex = overlays.volume ? 2 : 1;
      const rsi = chart.addSeries(LineSeries, { color: primary, lineWidth: 2, title: "RSI 14" }, paneIndex);
      rsi.setData(
        rsiSeries(closes)
          .map((v, i) => (v === null ? null : { time: candles[i]!.time, value: v }))
          .filter(Boolean) as { time: UTCTimestamp; value: number }[],
      );
      rsi.createPriceLine({ price: 70, color: bear, lineWidth: 1, lineStyle: 2, title: "70" });
      rsi.createPriceLine({ price: 30, color: bull, lineWidth: 1, lineStyle: 2, title: "30" });
      chart.panes()[paneIndex]?.setHeight(Math.round(height * 0.22));
    }

    if (overlays.signals) {
      const fast = sma(closes, 9);
      const slow = sma(closes, 21);
      const rsiVals = rsiSeries(closes);
      const markers: {
        time: UTCTimestamp;
        position: "belowBar" | "aboveBar";
        color: string;
        shape: "arrowUp" | "arrowDown";
        text: string;
      }[] = [];
      for (let i = 1; i < candles.length; i++) {
        const f = fast[i];
        const s = slow[i];
        const pf = fast[i - 1];
        const ps = slow[i - 1];
        if (f == null || s == null || pf == null || ps == null) continue;
        if (pf <= ps && f > s) {
          markers.push({
            time: candles[i]!.time,
            position: "belowBar",
            color: bull,
            shape: "arrowUp",
            text: `BUY${(rsiVals[i] ?? 50) < 45 ? " ·" : ""}`,
          });
        } else if (pf >= ps && f < s) {
          markers.push({ time: candles[i]!.time, position: "aboveBar", color: bear, shape: "arrowDown", text: "SELL" });
        }
      }
      createSeriesMarkers(candleSeries, markers);
    }

    chart.timeScale().fitContent();

    // Crosshair readout: report the hovered bar, and clear when the pointer
    // leaves the plot so the header falls back to the live price.
    chart.subscribeCrosshairMove((param) => {
      const cb = hoverRef.current;
      if (!cb) return;
      if (!param.time || !param.point) {
        cb(null);
        return;
      }
      const bar = param.seriesData.get(candleSeries) as Candle | undefined;
      cb(bar ? { ...bar, time: param.time as UTCTimestamp } : null);
    });
    const leave = () => hoverRef.current?.(null);
    el.addEventListener("mouseleave", leave);

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) chart.resize(w, height);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      el.removeEventListener("mouseleave", leave);
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, overlays, height, themeKey]);

  if (candles.length === 0) {
    return (
      <div className="grid w-full place-items-center text-xs text-muted-foreground" style={{ height }}>
        No price history available for this range yet.
      </div>
    );
  }

  return <div ref={holder} className="w-full" style={{ height }} />;
}
