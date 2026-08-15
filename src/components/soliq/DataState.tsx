/**
 * Live-data status primitives.
 *
 * Every live SOLIQ surface renders one of these so source, timestamp and
 * freshness are always visible, and loading / stale / error / unavailable are
 * explicit states rather than blank space or invented numbers.
 */

import { AlertTriangle, Ban, CircleSlash, Clock, Loader2, Radio } from "lucide-react";
import type { ReactNode } from "react";

import type { DataEnvelope, DataState as State } from "@/engines/core/envelope";

const tone: Record<State, string> = {
  live: "text-bull border-bull/30 bg-bull/10",
  delayed: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  stale: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  loading: "text-muted-foreground border-border bg-muted/40",
  error: "text-bear border-bear/30 bg-bear/10",
  unavailable: "text-muted-foreground border-border bg-muted/30",
};

const copy: Record<State, string> = {
  live: "Live",
  delayed: "Delayed",
  stale: "Stale",
  loading: "Loading",
  error: "Error",
  unavailable: "Unavailable",
};

function Icon({ state }: { state: State }) {
  const cls = "size-3";
  if (state === "loading") return <Loader2 className={`${cls} animate-spin`} />;
  if (state === "live") return <Radio className={cls} />;
  if (state === "error") return <AlertTriangle className={cls} />;
  if (state === "unavailable") return <Ban className={cls} />;
  return <Clock className={cls} />;
}

export function ago(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

/** Compact provenance pill: state · source · age. */
export function DataStatus({
  state,
  source,
  ageMs,
  fetchedAt,
  fallback,
  className = "",
}: {
  state: State;
  source?: string | null;
  ageMs?: number | null;
  fetchedAt?: number | null;
  fallback?: boolean;
  className?: string;
}) {
  const stamp = fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : null;
  return (
    <span
      title={stamp ? `Fetched ${stamp}${source ? ` from ${source}` : ""}` : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase ${tone[state]} ${className}`}
    >
      <Icon state={state} />
      {copy[state]}
      {source ? <span className="opacity-70 normal-case">· {source}</span> : null}
      {fallback ? <span className="opacity-70 normal-case">· fallback</span> : null}
      {ageMs !== null && ageMs !== undefined && state !== "loading" ? (
        <span className="opacity-70 normal-case">· {ago(ageMs)}</span>
      ) : null}
    </span>
  );
}

/** Pill driven straight off an engine envelope. */
export function EnvelopeStatus<T>({ env, className }: { env: DataEnvelope<T> | undefined; className?: string }) {
  if (!env) return <DataStatus state="loading" {...(className ? { className } : {})} />;
  return (
    <DataStatus
      state={env.state}
      source={env.sourceLabel}
      ageMs={env.ageMs}
      fetchedAt={env.fetchedAt}
      fallback={env.fallback}
      {...(className ? { className } : {})}
    />
  );
}

/** Honest placeholder for a slice with nothing to render. */
export function DataUnavailable({
  reason = "This data slice is not available on the current data plan.",
  state = "unavailable",
  className = "",
}: {
  reason?: string;
  state?: State;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center ${className}`}
    >
      <CircleSlash className="size-4 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{reason}</p>
      <DataStatus state={state} />
    </div>
  );
}

/**
 * Renders children only when the envelope carries data, otherwise shows the
 * matching loading / error / unavailable surface.
 */
export function DataSlice<T>({
  env,
  loading,
  children,
}: {
  env: DataEnvelope<T> | undefined;
  loading?: boolean;
  children: (data: T, env: DataEnvelope<T>) => ReactNode;
}) {
  if (loading || !env) return <DataUnavailable state="loading" reason="Loading live data…" />;
  if (!env.data) return <DataUnavailable state={env.state} reason={env.reason ?? "No data available."} />;
  return <>{children(env.data, env)}</>;
}
