import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Building2, Loader2, PlugZap, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/soliq/AppShell";
import { BrokeragePortal } from "@/components/soliq/BrokeragePortal";
import { EnvelopeStatus } from "@/components/soliq/DataState";
import { SectionTitle, StatCard } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import {
  useBrokerage,
  useBrokerageConnections,
  useBrokerageLink,
  useConfirmBrokerageConnection,
  type BrokerageLinkInput,
} from "@/hooks/use-brokerage";
import { useSession } from "@/hooks/use-soliq-account";
import { fmtNum, fmtUsd } from "@/lib/format";

export const Route = createFileRoute("/brokerage")({
  head: () => ({
    meta: [
      { title: "Brokerage Accounts — Live Positions & P&L | SOLIQ" },
      {
        name: "description",
        content:
          "Link your brokerage read-only through SnapTrade and stream live account balances, positions, cost basis, unrealized P&L and full trade history into SOLIQ.",
      },
      { property: "og:title", content: "Brokerage Accounts — SOLIQ" },
      {
        property: "og:description",
        content: "Read-only brokerage sync: balances, positions, cost basis, P&L and trade history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Brokerage,
});

function Brokerage() {
  const { isSignedIn } = useSession();
  const query = useBrokerage(isSignedIn);
  const connections = useBrokerageConnections(isSignedIn);
  const link = useBrokerageLink();
  const confirm = useConfirmBrokerageConnection();
  const [loginLink, setLoginLink] = useState<string | null>(null);
  const env = query.data;
  const snap = env?.data ?? null;
  const conns = connections.data?.connections ?? [];
  const broken = conns.filter((c) => c.disabled);

  const openPortal = (input: BrokerageLinkInput = {}) => {
    link.mutate(
      {
        connectionType: "read",
        ...(typeof window === "undefined" ? {} : { redirectTo: `${window.location.origin}/brokerage` }),
        ...input,
      },
      {
        onSuccess: (res) => {
          if (res.error || !res.url) {
            toast.error(res.error ?? "Could not start the brokerage connection");
            return;
          }
          setLoginLink(res.url);
        },
        onError: () => toast.error("Could not start the brokerage connection"),
      },
    );
  };

  const connect = () => openPortal();
  const reconnect = (authorizationId: string) => openPortal({ reconnect: authorizationId });

  const handleSuccess = (authorizationId: string) => {
    setLoginLink(null);
    confirm.mutate(authorizationId, {
      onSettled: () => {
        void query.refetch();
        void connections.refetch();
      },
    });
    toast.success("Brokerage connected — syncing accounts and positions.");
  };

  const handleError = (data: { errorCode?: string; detail?: string }) => {
    setLoginLink(null);
    toast.error(data.detail ?? "SnapTrade could not complete the connection", {
      ...(data.errorCode ? { description: `Error code ${data.errorCode}` } : {}),
    });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <SectionTitle
          title="Brokerage accounts"
          subtitle="Read-only sync via SnapTrade — balances, positions, cost basis, P&L and every past trade."
          action={
            <div className="flex items-center gap-2">
              {env ? <EnvelopeStatus env={env} /> : null}
              <Button size="sm" variant="outline" onClick={() => void query.refetch()} disabled={!isSignedIn}>
                <RefreshCw className={`size-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> Sync
              </Button>
              <Button size="sm" onClick={connect} disabled={!isSignedIn || link.isPending}>
                {link.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Building2 className="size-3.5" />}
                Link brokerage
              </Button>
            </div>
          }
        />

        <BrokeragePortal
          loginLink={loginLink}
          isOpen={Boolean(loginLink)}
          close={() => setLoginLink(null)}
          onSuccess={handleSuccess}
          onError={handleError}
          onExit={() => setLoginLink(null)}
        />

        {isSignedIn && broken.length ? (
          <div className="glass space-y-2 rounded-xl border border-bear/40 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-bear">
              <AlertTriangle className="size-4" /> {broken.length} connection{broken.length === 1 ? "" : "s"} need
              attention
            </p>
            {broken.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {c.brokerage ?? "Brokerage"} · disabled
                  {c.disabledDate ? ` on ${new Date(c.disabledDate).toLocaleDateString()}` : ""}
                </span>
                <Button size="sm" variant="outline" onClick={() => reconnect(c.id)} disabled={link.isPending}>
                  <PlugZap className="size-3.5" /> Reconnect
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {isSignedIn && conns.filter((c) => !c.disabled).length ? (
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-muted-foreground">
              Active connections: {conns.filter((c) => !c.disabled).map((c) => c.brokerage ?? "Brokerage").join(", ")}
            </p>
          </div>
        ) : null}

        {!isSignedIn ? (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">Sign in to link a brokerage and stream live positions.</p>
            <Button asChild className="mt-4" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        ) : null}

        {isSignedIn && snap ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Market value" value={fmtUsd(snap.totals.marketValue)} />
              <StatCard label="Cash" value={fmtUsd(snap.totals.cash)} />
              <StatCard label="Unrealized P&L" value={fmtUsd(snap.totals.unrealizedPnl)} />
              <StatCard label="Positions" value={fmtNum(snap.totals.positions)} />
            </div>

            {snap.accounts.map((a) => (
              <div key={a.id} className="glass overflow-hidden rounded-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{a.name ?? a.institution ?? "Brokerage account"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[a.institution, a.accountType, a.currency].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <p className="num text-sm">{a.totalValue !== null ? fmtUsd(a.totalValue) : "—"}</p>
                </div>
                {a.positions.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">No positions in this account.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-4 py-2 text-left font-medium">Symbol</th>
                          <th className="px-4 py-2 text-right font-medium">Qty</th>
                          <th className="px-4 py-2 text-right font-medium">Avg cost</th>
                          <th className="px-4 py-2 text-right font-medium">Price</th>
                          <th className="px-4 py-2 text-right font-medium">Value</th>
                          <th className="px-4 py-2 text-right font-medium">P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.positions.map((p) => (
                          <tr key={`${a.id}-${p.symbol}`} className="border-b border-border/50 last:border-0">
                            <td className="px-4 py-2">
                              <Link
                                to="/symbol/$market/$symbol"
                                params={{ market: "stocks", symbol: p.symbol }}
                                className="font-semibold hover:text-primary"
                              >
                                {p.symbol}
                              </Link>
                              {p.description ? (
                                <span className="ml-2 text-[10px] text-muted-foreground">{p.description}</span>
                              ) : null}
                            </td>
                            <td className="num px-4 py-2 text-right">{p.quantity}</td>
                            <td className="num px-4 py-2 text-right">{p.avgCost !== null ? fmtUsd(p.avgCost) : "—"}</td>
                            <td className="num px-4 py-2 text-right">{p.price !== null ? fmtUsd(p.price) : "—"}</td>
                            <td className="num px-4 py-2 text-right">
                              {p.marketValue !== null ? fmtUsd(p.marketValue) : "—"}
                            </td>
                            <td
                              className={`num px-4 py-2 text-right ${
                                (p.unrealizedPnl ?? 0) >= 0 ? "text-bull" : "text-bear"
                              }`}
                            >
                              {p.unrealizedPnl !== null ? fmtUsd(p.unrealizedPnl) : "—"}
                              {p.unrealizedPct !== null ? (
                                <span className="ml-1 opacity-70">({p.unrealizedPct.toFixed(2)}%)</span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}

            <div className="glass overflow-hidden rounded-xl">
              <div className="border-b border-border px-4 py-3 text-sm font-semibold">Trade history</div>
              {snap.activities.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">No trade history returned yet.</p>
              ) : (
                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background/90 text-muted-foreground backdrop-blur">
                      <tr className="border-b border-border">
                        <th className="px-4 py-2 text-left font-medium">Date</th>
                        <th className="px-4 py-2 text-left font-medium">Symbol</th>
                        <th className="px-4 py-2 text-left font-medium">Action</th>
                        <th className="px-4 py-2 text-right font-medium">Qty</th>
                        <th className="px-4 py-2 text-right font-medium">Price</th>
                        <th className="px-4 py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.activities.slice(0, 200).map((t) => (
                        <tr key={t.id} className="border-b border-border/50 last:border-0">
                          <td className="num px-4 py-2">
                            {t.executedAt ? new Date(t.executedAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-2 font-semibold">{t.symbol ?? "—"}</td>
                          <td className="px-4 py-2 uppercase">{t.side ?? t.type ?? "—"}</td>
                          <td className="num px-4 py-2 text-right">{t.quantity ?? "—"}</td>
                          <td className="num px-4 py-2 text-right">{t.price !== null ? fmtUsd(t.price) : "—"}</td>
                          <td className="num px-4 py-2 text-right">{t.amount !== null ? fmtUsd(t.amount) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}

        {isSignedIn && env && !snap ? (
          <div className="glass rounded-xl p-8 text-center">
            <Building2 className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">{env.reason ?? "No brokerage data available."}</p>
            <Button className="mt-4" size="sm" onClick={connect} disabled={link.isPending}>
              <Building2 className="size-3.5" /> Link a brokerage
            </Button>
          </div>
        ) : null}

        {isSignedIn && query.isLoading ? (
          <div className="glass grid place-items-center rounded-xl p-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
