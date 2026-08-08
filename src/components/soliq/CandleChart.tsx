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

export type Candle = { time: UTCTimestamp; open: number; high: number; low: number; close: number };

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

function bucketMs(id: IntervalId) {
  return intervals.find((i) => i.id === id)?.ms ?? 86_400_000;
}

/** Aggregate a price series into OHLC candles at the requested interval. */
export function toCandles(points: Point[], interval: IntervalId): Candle[] {
  const size = bucketMs(interval);
  const out: Candle[] = [];
  let bucket = -1;
  for (const { t, p } of points) {
    const key = Math.floor(t / size) * size;
    const last = out[out.length - 1];
    if (key !== bucket || !last) {
      out.push({ time: (key / 1000) as UTCTimestamp, open: p, high: p, low: p, close: p });
      bucket = key;
    } else {
      last.high = Math.max(last.high, p);
      last.low = Math.min(last.low, p);
      last.close = p;
    }
  }
  return out;
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

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
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
  const [themeKey, setThemeKey] = useState(0);

  const candles = useMemo(() => toCandles(points, interval), [points, interval]);

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeKey((k) => k + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = holder.current;
    if (!el || candles.length === 0) return;

    const text = cssVar("--muted-foreground", "#8b8ba7");
    const grid = "rgba(140,140,180,0.12)";
    const bull = cssVar("--bull", "#14f195");
    const bear = cssVar("--bear", "#ff5470");
    const primary = cssVar("--primary", "#9945ff");
    const warn = cssVar("--warn", "#f5c542");

    const chart = createChart(el, {
      height,
      layout: {
        background: { color: "transparent" },
        textColor: text,
        fontFamily: "JetBrains Mono, monospace",
        attributionLogo: false,
        panes: { separatorColor: grid, separatorHoverColor: grid },
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: 0,
        vertLine: { color: primary, width: 1, style: 2, labelBackgroundColor: primary },
        horzLine: { color: primary, width: 1, style: 2, labelBackgroundColor: primary },
      },
    });
    chartRef.current = chart;

    // Hollow candles: transparent bodies, coloured borders/wicks.
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "transparent",
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
        color: cssVar("--chart-5", "#5eb0ff"),
        lineWidth: 2,
        lineStyle: 2,
        priceLineVisible: false,
        title: "VWAP",
      });
      let pv = 0;
      let vv = 0;
      const data = candles.map((c, i) => {
        const typical = (c.high + c.low + c.close) / 3;
        const vol = volumes?.[i]?.v ?? 1;
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
        candles.map((c, i) => ({
          time: c.time,
          value: volumes?.[i]?.v ?? Math.abs(c.close - c.open) * 1000,
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

    if (onHover) {
      chart.subscribeCrosshairMove((param) => {
        const bar = param.seriesData.get(candleSeries) as Candle | undefined;
        onHover(bar ?? null);
      });
    }

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, volumes, overlays, height, onHover, themeKey]);

  return <div ref={holder} className="w-full" />;
}
