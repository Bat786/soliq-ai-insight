import { createFileRoute } from "@tanstack/react-router";
import { Bell, ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/soliq/AppShell";
import { AssetRow, Delta } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assets, byId, watchlists as seedLists } from "@/lib/market-data";

export const Route = createFileRoute("/lists")({
  head: () => ({
    meta: [
      { title: "Watchlists — SOLIQ" },
      {
        name: "description",
        content: "Build unlimited SOLIQ watchlists, group assets by thesis, set alerts and track list performance.",
      },
      { property: "og:title", content: "Watchlists — SOLIQ" },
      { property: "og:description", content: "Unlimited multi-watchlists with alerts and performance tracking." },
    ],
  }),
  component: Lists,
});

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
      <p className="text-sm text-muted-foreground">Unlimited lists, grouped by thesis.</p>

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
                <p className="text-xs text-muted-foreground">
                  {active.assetIds.length} assets · {active.alerts} active alerts
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="subtle" size="sm">
                  <Bell className="size-4" /> Set alert
                </Button>
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
