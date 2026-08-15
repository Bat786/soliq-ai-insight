import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, CheckCircle2, CircleSlash, RefreshCw, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/soliq/AppShell";
import { Button } from "@/components/ui/button";
import { getDataStatus } from "@/lib/status.functions";
import type { ProviderState } from "@/lib/status.server";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "SOLIQ Data Status — Live Feed & Entitlement Health" },
      {
        name: "description",
        content:
          "Live health of every SOLIQ market feed: minute bars, real-time snapshots, crypto pools, options flow and wallet RPC, plus the fallback used when a feed is limited.",
      },
      { property: "og:title", content: "SOLIQ Data Status" },
      { property: "og:description", content: "Feed-by-feed health and fallbacks for the AETHRON data engine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatusPage,
});

const tone: Record<ProviderState, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  live: { label: "Live", cls: "text-success border-success/30 bg-success/10", Icon: CheckCircle2 },
  degraded: { label: "Degraded", cls: "text-warning border-warning/30 bg-warning/10", Icon: TriangleAlert },
  unentitled: { label: "Not entitled", cls: "text-warning border-warning/30 bg-warning/10", Icon: CircleSlash },
  "missing-key": { label: "No key", cls: "text-muted-foreground border-border bg-surface-2/60", Icon: CircleSlash },
};

function StatusPage() {
  const fetchStatus = useServerFn(getDataStatus);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["data-status"],
    queryFn: () => fetchStatus(),
    refetchInterval: 60_000,
  });

  const m = data?.massive;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-xl font-bold lg:text-2xl">
              <Activity className="size-5 text-primary" /> Data status
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              What each upstream feed is serving the AETHRON engine, and the fallback in use when a feed is limited.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {m && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Request cap", value: m.rpmLimit ? `${m.rpmLimit} / min` : "Unlimited" },
              { label: "Minute bars", value: m.minuteBars ? "Authenticated" : "Unavailable" },
              { label: "Real-time snapshots", value: m.realtimeSnapshots ? "Authenticated" : "Not in plan" },
              { label: "Cached responses", value: String(m.cacheEntries) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-surface-2/50 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-sm font-semibold">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {(data?.providers ?? []).map((p) => {
            const t = tone[p.state];
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface-2/40 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.detail}</p>
                  {p.fallback && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="text-foreground/80">Fallback:</span> {p.fallback}
                    </p>
                  )}
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${t.cls}`}>
                  <t.Icon className="size-3.5" /> {t.label}
                </span>
              </div>
            );
          })}
        </div>

        {m && m.unentitled.length > 0 && (
          <div className="mt-6 rounded-xl border border-warning/30 bg-warning/5 p-4">
            <p className="text-sm font-semibold">Endpoints your plan refused</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {m.unentitled.map((u) => (
                <li key={u.scope}>
                  <span className="font-mono text-foreground/80">{u.scope}</span> — {u.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {m?.lastError && (
          <p className="mt-4 text-xs text-muted-foreground">Last provider message: {m.lastError}</p>
        )}
        {data && (
          <p className="mt-2 text-xs text-muted-foreground">
            Checked {new Date(data.checkedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </AppShell>
  );
}
