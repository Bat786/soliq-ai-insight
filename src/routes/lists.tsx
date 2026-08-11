import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/soliq/AppShell";
import { AssetRow, Delta } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile, useSession } from "@/hooks/use-soliq-account";
import { assets, byId, fmtUsd, watchlists as seedLists } from "@/lib/market-data";
import { FREE_ALERT_LIMIT, isPaid } from "@/lib/membership";
import { createAlert, deleteAlert, listAlerts, setAlertActive } from "@/lib/soliq.functions";

export const Route = createFileRoute("/lists")({
  head: () => ({
    meta: [
      { title: "Watchlists & Price Alerts — SOLIQ" },
      {
        name: "description",
        content: "Build SOLIQ watchlists, group assets by thesis and get in-app alert notifications when prices cross your targets.",
      },
      { property: "og:title", content: "Watchlists & Price Alerts — SOLIQ" },
      { property: "og:description", content: "Unlimited watchlists with working price alerts and notifications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Lists,
});

function AlertsPanel({ listName, assetIds }: { listName: string; assetIds: string[] }) {
  const { isSignedIn } = useSession();
  const { tier } = useProfile();
  const queryClient = useQueryClient();
  const fetchAlerts = useServerFn(listAlerts);
  const addAlert = useServerFn(createAlert);
  const removeAlert = useServerFn(deleteAlert);
  const toggleAlert = useServerFn(setAlertActive);

  const pool = assetIds.length ? assetIds : assets.map((a) => a.id);
  const [assetId, setAssetId] = useState(pool[0]!);
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState("");

  const alertsQuery = useQuery({
    queryKey: ["alerts"],
    queryFn: () => fetchAlerts(),
    enabled: isSignedIn,
  });
  const alerts = alertsQuery.data ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const create = useMutation({
    mutationFn: () =>
      addAlert({ data: { listName, assetId, direction, threshold: Number(threshold) } }),
    onSuccess: (res) => {
      if (res.limitReached) {
        toast.error(`Free plan is limited to ${FREE_ALERT_LIMIT} alerts. Upgrade for unlimited alerts.`);
        return;
      }
      setThreshold("");
      toast.success("Alert armed — you'll be notified when it triggers.");
      invalidate();
    },
    onError: () => toast.error("Could not create that alert."),
  });

  if (!isSignedIn) {
    return (
      <div className="panel p-5">
        <h3 className="font-display flex items-center gap-2 text-sm font-semibold">
          <Bell className="size-4 text-primary" /> Price alerts
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to arm price alerts and receive in-app notifications when your targets hit.
        </p>
        <Button asChild variant="hero" size="sm" className="mt-3">
          <Link to="/auth">Sign in to set alerts</Link>
        </Button>
      </div>
    );
  }

  const current = byId(assetId);

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display flex items-center gap-2 text-sm font-semibold">
          <Bell className="size-4 text-primary" /> Price alerts
        </h3>
        <p className="num text-[11px] text-muted-foreground">
          {alerts.length} armed{isPaid(tier) ? " · unlimited" : ` · ${FREE_ALERT_LIMIT} on free plan`}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-28">
          <label className="text-[11px] text-muted-foreground" htmlFor="alert-asset">
            Asset
          </label>
          <select
            id="alert-asset"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="num mt-1 h-9 w-full rounded-md border border-border bg-surface-2/40 px-2 text-sm"
          >
            {pool.map((id) => {
              const a = byId(id);
              return a ? (
                <option key={id} value={id}>
                  {a.symbol}
                </option>
              ) : null;
            })}
          </select>
        </div>
        <div className="min-w-24">
          <label className="text-[11px] text-muted-foreground" htmlFor="alert-dir">
            Condition
          </label>
          <select
            id="alert-dir"
            value={direction}
            onChange={(e) => setDirection(e.target.value as "above" | "below")}
            className="mt-1 h-9 w-full rounded-md border border-border bg-surface-2/40 px-2 text-sm"
          >
            <option value="above">Crosses above</option>
            <option value="below">Drops below</option>
          </select>
        </div>
        <div className="min-w-28 flex-1">
          <label className="text-[11px] text-muted-foreground" htmlFor="alert-price">
            Target price {current ? `(now ${fmtUsd(current.price)})` : ""}
          </label>
          <Input
            id="alert-price"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1 h-9 bg-surface-2/40"
          />
        </div>
        <Button
          variant="hero"
          size="sm"
          className="h-9"
          disabled={!threshold || Number.isNaN(Number(threshold)) || Number(threshold) <= 0 || create.isPending}
          onClick={() => create.mutate()}
        >
          <Plus className="size-4" /> Arm alert
        </Button>
      </div>

      <div className="mt-4 divide-y divide-border/60">
        {alerts.length === 0 && (
          <p className="py-5 text-center text-xs text-muted-foreground">No alerts armed yet.</p>
        )}
        {alerts.map((a) => (
          <div key={a.id} className="flex items-center gap-3 py-2.5">
            <span className="num w-14 text-sm">{a.asset_symbol}</span>
            <span className="num flex-1 text-xs text-muted-foreground">
              {a.direction === "above" ? "≥" : "≤"} {fmtUsd(Number(a.threshold))} · {a.list_name}
              {a.last_triggered_at ? " · triggered" : ""}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={a.active ? "Pause alert" : "Resume alert"}
              onClick={async () => {
                await toggleAlert({ data: { id: a.id, active: !a.active } });
                invalidate();
              }}
            >
              {a.active ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete alert"
              onClick={async () => {
                await removeAlert({ data: { id: a.id } });
                invalidate();
              }}
            >
              <Trash2 className="size-4 text-bear" />
            </Button>
          </div>
        ))}
      </div>

      {!isPaid(tier) && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Free plan allows {FREE_ALERT_LIMIT} alerts.{" "}
          <Link to="/pricing" className="text-primary">
            Go Premium for unlimited →
          </Link>
        </p>
      )}
    </div>
  );
}

function Lists() {
  const [lists, setLists] = useState(seedLists);
  const [activeId, setActiveId] = useState(seedLists[0]!.id);
  const [name, setName] = useState("");
  const active = lists.find((l) => l.id === activeId) ?? lists[0]!;

  const createList = () => {
    if (!name.trim()) return;
    const id = `${name.toLowerCase().replace(/\s+/g, "-")}-${lists.length}`;
    setLists([...lists, { id, name: name.trim(), assetIds: [], perf: 0, alerts: 0 }]);
    setActiveId(id);
    setName("");
  };

  const toggleAsset = (assetId: string) =>
    setLists(
      lists.map((l) =>
        l.id === active.id
          ? {
              ...l,
              assetIds: l.assetIds.includes(assetId)
                ? l.assetIds.filter((a) => a !== assetId)
                : [...l.assetIds, assetId],
            }
          : l,
      ),
    );

  return (
    <AppShell>
      <h1 className="flex items-center gap-2 text-xl font-bold lg:text-2xl">
        <ListChecks className="size-5 text-primary" /> Watchlists
      </h1>
      <p className="text-sm text-muted-foreground">Unlimited lists, grouped by thesis — with working price alerts.</p>

      <div className="mt-4 grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="panel p-4">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createList()}
              placeholder="New list name"
              className="h-9"
            />
            <Button size="icon" variant="hero" onClick={createList} aria-label="Create list">
              <Plus />
            </Button>
          </div>
          <div className="mt-3 space-y-1">
            {lists.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveId(l.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  l.id === active.id ? "bg-primary/12 text-primary" : "hover:bg-accent"
                }`}
              >
                <span className="truncate">
                  {l.name}
                  <span className="num ml-2 text-[11px] text-muted-foreground">{l.assetIds.length}</span>
                </span>
                <Delta value={l.perf} />
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-5">
          <div className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">{active.name}</h2>
                <p className="text-xs text-muted-foreground">{active.assetIds.length} assets</p>
              </div>
              <Button
                variant="bear"
                size="sm"
                onClick={() => {
                  const rest = lists.filter((l) => l.id !== active.id);
                  if (rest.length) {
                    setLists(rest);
                    setActiveId(rest[0]!.id);
                  }
                }}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>
            <div className="mt-3">
              {active.assetIds.map((id) => {
                const a = byId(id);
                return a ? <AssetRow key={id} asset={a} /> : null;
              })}
              {active.assetIds.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Empty list — add assets from the picker below.
                </p>
              )}
            </div>
          </div>

          <AlertsPanel listName={active.name} assetIds={active.assetIds} />

          <div className="panel p-5">
            <h3 className="font-display text-sm font-semibold">Add or remove assets</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {assets.map((a) => {
                const inList = active.assetIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAsset(a.id)}
                    className={`num rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      inList
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border bg-surface-2/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {a.symbol}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
