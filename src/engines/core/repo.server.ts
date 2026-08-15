/**
 * SOLIQ persistence layer — server only.
 *
 * The engines fetch from upstream providers; this module is the only place that
 * writes those results into Postgres and reads them back. Every write is
 * best-effort: a persistence failure must never blank a live desk, so the
 * helpers swallow errors and simply report whether the row landed.
 */

import type { Bar } from "@/lib/futures.server";
import type { MarketScan, ScanRow } from "@/lib/scan.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  } catch {
    return null;
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Snapshot one scan bucket (gainers / losers / high volume) for history + realtime. */
export async function saveScannerResults(
  scanId: string,
  rows: ScanRow[],
  meta: { session: MarketScan["session"]; assetKind?: string; source?: string; ts?: number },
): Promise<number> {
  const db = await admin();
  if (!db || rows.length === 0) return 0;
  const ts = iso(meta.ts ?? Date.now());
  const payload = rows.map((r, i) => ({
    scan_id: scanId,
    session_mode: meta.session,
    asset_kind: meta.assetKind ?? "stock",
    symbol: r.ticker,
    rank: i + 1,
    score: Number.isFinite(r.relVolume) ? Number((r.relVolume * 10).toFixed(2)) : null,
    metrics: {
      price: r.price,
      changePct: r.changePct,
      volume: r.volume,
      prevClose: r.prevClose,
      relVolume: r.relVolume,
      vwap: r.vwap,
    },
    reasons: [
      r.changePct >= 0 ? `Up ${r.changePct.toFixed(2)}% on the session` : `Down ${r.changePct.toFixed(2)}% on the session`,
      `Relative volume ${r.relVolume.toFixed(2)}x`,
    ],
    source: meta.source ?? "massive",
    ts,
  }));
  const { error } = await db.from("scanner_results").insert(payload);
  return error ? 0 : payload.length;
}

/** Persist an entire market scan under its three buckets. */
export async function saveMarketScan(scan: MarketScan, assetKind = "stock"): Promise<void> {
  const meta = { session: scan.session, assetKind, ts: scan.updatedAt };
  await Promise.all([
    saveScannerResults("gainers", scan.gainers, meta),
    saveScannerResults("losers", scan.losers, meta),
    saveScannerResults("high-volume", scan.highVolume, meta),
  ]);
}

export type StoredScanRow = {
  symbol: string;
  rank: number | null;
  score: number | null;
  metrics: Record<string, number | null>;
  reasons: string[];
  ts: string;
  source: string;
};

/** Latest stored rows for a bucket — used when every upstream feed is down. */
export async function readScannerResults(scanId: string, limit = 20): Promise<StoredScanRow[]> {
  const db = await admin();
  if (!db) return [];
  const { data, error } = await db
    .from("scanner_results")
    .select("symbol, rank, score, metrics, reasons, ts, source")
    .eq("scan_id", scanId)
    .order("ts", { ascending: false })
    .order("rank", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  const newest = data[0]?.ts;
  return data
    .filter((r) => r.ts === newest)
    .map((r) => ({
      symbol: r.symbol,
      rank: r.rank,
      score: r.score,
      metrics: (r.metrics ?? {}) as Record<string, number | null>,
      reasons: Array.isArray(r.reasons) ? (r.reasons as string[]) : [],
      ts: r.ts,
      source: r.source,
    }));
}

/** Upsert candles so a symbol keeps a local history even when a plan de-entitles it. */
export async function saveCandles(
  symbol: string,
  assetId: string,
  timeframe: string,
  bars: Bar[],
  source: string,
): Promise<number> {
  const db = await admin();
  if (!db || bars.length === 0) return 0;
  const payload = bars.slice(-500).map((b) => ({
    asset_id: assetId,
    symbol,
    timeframe,
    t: iso(b.t > 1e12 ? b.t : b.t * 1000),
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume ?? 0,
    source,
  }));
  const { error } = await db.from("asset_candles").upsert(payload, { onConflict: "asset_id,timeframe,t" });
  return error ? 0 : payload.length;
}

/** Record the latest quote for an asset. */
export async function savePrice(input: {
  assetId: string;
  symbol: string;
  price: number;
  changePct?: number | null;
  change?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  prevClose?: number | null;
  volume?: number | null;
  source: string;
  ts?: number;
}): Promise<boolean> {
  const db = await admin();
  if (!db) return false;
  const { error } = await db.from("asset_prices").insert({
    asset_id: input.assetId,
    symbol: input.symbol,
    price: input.price,
    change: input.change ?? null,
    change_pct: input.changePct ?? null,
    open: input.open ?? null,
    high: input.high ?? null,
    low: input.low ?? null,
    prev_close: input.prevClose ?? null,
    volume: input.volume ?? null,
    source: input.source,
    ts: iso(input.ts ?? Date.now()),
  });
  return !error;
}

/** Keep the asset directory in sync as symbols are discovered. */
export async function upsertAsset(input: {
  id: string;
  kind: string;
  symbol: string;
  name?: string | null;
  exchange?: string | null;
  address?: string | null;
  currency?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const db = await admin();
  if (!db) return false;
  const { error } = await db.from("assets").upsert(
    {
      id: input.id,
      kind: input.kind,
      symbol: input.symbol,
      name: input.name ?? null,
      exchange: input.exchange ?? null,
      address: input.address ?? null,
      currency: input.currency ?? "USD",
      metadata: (input.metadata ?? {}) as never,
    },
    { onConflict: "id" },
  );
  return !error;
}
