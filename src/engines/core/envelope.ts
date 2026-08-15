/**
 * DataEnvelope — the single contract every SOLIQ engine returns and every live
 * data component renders. It carries provenance (source), freshness
 * (fetchedAt / ageMs) and an explicit state so the UI can honestly show
 * loading, delayed, stale, error or unavailable instead of inventing numbers.
 *
 * Client-safe: no provider code, no secrets.
 */

import type { ProviderId } from "@/engines/core/types";

export type DataState = "live" | "delayed" | "stale" | "loading" | "error" | "unavailable";

export type DataEnvelope<T> = {
  data: T | null;
  /** Provider that actually served the payload (may be a fallback). */
  source: ProviderId | null;
  /** Human label for the source, e.g. "Massive · delayed aggregates". */
  sourceLabel: string | null;
  /** ms epoch when the payload was fetched upstream. */
  fetchedAt: number | null;
  /** Age of the payload at serialization time, ms. */
  ageMs: number | null;
  state: DataState;
  /** Why the slice is unavailable / errored — safe to show to users. */
  reason: string | null;
  /** True when a fallback provider answered instead of the primary. */
  fallback: boolean;
};

export type FreshnessPolicy = {
  /** Younger than this = "live". */
  liveMs: number;
  /** Younger than this = "delayed"; older = "stale". */
  delayedMs: number;
};

export const freshness = {
  intraday: { liveMs: 90_000, delayedMs: 15 * 60_000 },
  daily: { liveMs: 15 * 60_000, delayedMs: 24 * 3_600_000 },
  flow: { liveMs: 5 * 60_000, delayedMs: 60 * 60_000 },
  filings: { liveMs: 24 * 3_600_000, delayedMs: 30 * 24 * 3_600_000 },
  news: { liveMs: 5 * 60_000, delayedMs: 6 * 3_600_000 },
} satisfies Record<string, FreshnessPolicy>;

export function stateFor(ageMs: number, policy: FreshnessPolicy): DataState {
  if (ageMs <= policy.liveMs) return "live";
  if (ageMs <= policy.delayedMs) return "delayed";
  return "stale";
}

export function ok<T>(
  data: T,
  opts: {
    source: ProviderId;
    sourceLabel?: string;
    fetchedAt?: number;
    policy?: FreshnessPolicy;
    fallback?: boolean;
  },
): DataEnvelope<T> {
  const fetchedAt = opts.fetchedAt ?? Date.now();
  const ageMs = Math.max(0, Date.now() - fetchedAt);
  return {
    data,
    source: opts.source,
    sourceLabel: opts.sourceLabel ?? opts.source,
    fetchedAt,
    ageMs,
    state: stateFor(ageMs, opts.policy ?? freshness.intraday),
    reason: null,
    fallback: opts.fallback ?? false,
  };
}

export function unavailable<T>(reason: string, source: ProviderId | null = null): DataEnvelope<T> {
  return {
    data: null,
    source,
    sourceLabel: source,
    fetchedAt: Date.now(),
    ageMs: 0,
    state: "unavailable",
    reason,
    fallback: false,
  };
}

export function failed<T>(reason: string, source: ProviderId | null = null): DataEnvelope<T> {
  return {
    data: null,
    source,
    sourceLabel: source,
    fetchedAt: Date.now(),
    ageMs: 0,
    state: "error",
    reason,
    fallback: false,
  };
}

/** Recompute `ageMs`/`state` on the client so freshness keeps ticking after transport. */
export function refresh<T>(env: DataEnvelope<T>, policy: FreshnessPolicy = freshness.intraday): DataEnvelope<T> {
  if (!env.fetchedAt || env.state === "unavailable" || env.state === "error") return env;
  const ageMs = Math.max(0, Date.now() - env.fetchedAt);
  return { ...env, ageMs, state: stateFor(ageMs, policy) };
}

/** Worst state across several slices — used for page-level status pills. */
const rank: Record<DataState, number> = { live: 0, delayed: 1, loading: 2, stale: 3, unavailable: 4, error: 5 };
export function worstState(states: DataState[]): DataState {
  return states.reduce<DataState>((acc, s) => (rank[s] > rank[acc] ? s : acc), "live");
}
