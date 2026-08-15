/**
 * Shared provider gateway — server only.
 *
 * One place for caching, per-provider rate limiting, retry with backoff and
 * ordered provider fallback. Adapters declare their budget; the gateway
 * enforces it and records provenance so `DataEnvelope` can report the source
 * that actually answered.
 */

import { failed, ok, unavailable, type DataEnvelope, type FreshnessPolicy } from "@/engines/core/envelope";
import type { ProviderId } from "@/engines/core/types";

type Budget = { perMinute: number; minGapMs: number };

const budgets: Partial<Record<ProviderId, Budget>> = {
  massive: { perMinute: 90, minGapMs: 160 },
  polygon: { perMinute: 90, minGapMs: 160 },
  "unusual-whales": { perMinute: 55, minGapMs: 220 },
  jupiter: { perMinute: 90, minGapMs: 120 },
  dexscreener: { perMinute: 240, minGapMs: 60 },
  pumpfun: { perMinute: 120, minGapMs: 120 },
  coingecko: { perMinute: 30, minGapMs: 900 },
  tape: { perMinute: 120, minGapMs: 90 },
  frankfurter: { perMinute: 60, minGapMs: 200 },
  alchemy: { perMinute: 120, minGapMs: 80 },
  "solana-rpc": { perMinute: 120, minGapMs: 90 },
};

const defaultBudget: Budget = { perMinute: 60, minGapMs: 200 };

type Lane = { window: number; used: number; lastAt: number; chain: Promise<unknown> };
const lanes = new Map<ProviderId, Lane>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function lane(provider: ProviderId): Lane {
  let l = lanes.get(provider);
  if (!l) {
    l = { window: 0, used: 0, lastAt: 0, chain: Promise.resolve() };
    lanes.set(provider, l);
  }
  return l;
}

/** False when this provider has spent its per-minute allowance. */
export function hasBudget(provider: ProviderId): boolean {
  const l = lane(provider);
  const b = budgets[provider] ?? defaultBudget;
  const now = Math.floor(Date.now() / 60_000);
  if (l.window !== now) {
    l.window = now;
    l.used = 0;
  }
  return l.used < b.perMinute;
}

/** Serialize + space out calls to one provider, respecting its minute budget. */
export function metered<T>(provider: ProviderId, task: () => Promise<T>): Promise<T> {
  const l = lane(provider);
  const b = budgets[provider] ?? defaultBudget;
  const run = l.chain.then(async () => {
    if (!hasBudget(provider)) throw new Error(`${provider}:rate-budget-exhausted`);
    l.used += 1;
    const wait = b.minGapMs - (Date.now() - l.lastAt);
    if (wait > 0) await sleep(wait);
    l.lastAt = Date.now();
    return task();
  });
  l.chain = run.catch(() => undefined);
  return run;
}

/* ---------------------------------- cache --------------------------------- */

type Entry = { at: number; value: unknown };
const store = new Map<string, Entry>();
const MAX_ENTRIES = 4000;

export function cacheGet<T>(key: string, ttlMs: number): { value: T; at: number } | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) return null;
  return { value: hit.value as T, at: hit.at };
}

export function cacheSet(key: string, value: unknown) {
  if (store.size > MAX_ENTRIES) {
    const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 500);
    for (const [k] of oldest) store.delete(k);
  }
  store.set(key, { at: Date.now(), value });
}

/** Cached + metered fetch of any provider payload. Returns `null` on failure. */
export async function fetchProvider<T>(opts: {
  provider: ProviderId;
  key: string;
  ttlMs: number;
  retries?: number;
  load: () => Promise<T | null>;
}): Promise<{ value: T; at: number } | null> {
  const cached = cacheGet<T>(opts.key, opts.ttlMs);
  if (cached) return cached;

  const attempts = Math.max(1, opts.retries ?? 2);
  for (let i = 0; i < attempts; i++) {
    try {
      const value = await metered(opts.provider, opts.load);
      if (value === null || value === undefined) return null;
      cacheSet(opts.key, value);
      return { value, at: Date.now() };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      // Budget exhaustion and hard authorization failures are not retryable.
      if (/rate-budget-exhausted|NOT_AUTHORIZED|401|403/i.test(msg)) return null;
      if (i === attempts - 1) return null;
      await sleep(250 * 2 ** i);
    }
  }
  return null;
}

/** JSON GET with timeout, for adapters that don't already have a client. */
export async function getJson<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 12_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type Candidate<T> = {
  provider: ProviderId;
  label: string;
  ttlMs: number;
  key: string;
  load: () => Promise<T | null>;
  /** Reject thin/empty payloads so the next provider gets a turn. */
  accept?: (value: T) => boolean;
};

/**
 * Try providers in order and wrap the winner in a DataEnvelope. Anything after
 * the first candidate is marked as a fallback so the UI can say so.
 */
export async function firstAvailable<T>(
  candidates: Candidate<T>[],
  opts: { policy?: FreshnessPolicy; unavailableReason: string },
): Promise<DataEnvelope<T>> {
  let lastError: string | null = null;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i] as Candidate<T>;
    try {
      const hit = await fetchProvider<T>({ provider: c.provider, key: c.key, ttlMs: c.ttlMs, load: c.load });
      if (!hit) continue;
      if (c.accept && !c.accept(hit.value)) continue;
      return ok(hit.value, {
        source: c.provider,
        sourceLabel: c.label,
        fetchedAt: hit.at,
        ...(opts.policy ? { policy: opts.policy } : {}),
        fallback: i > 0,
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "provider error";
    }
  }
  return lastError ? failed<T>(lastError) : unavailable<T>(opts.unavailableReason);
}
