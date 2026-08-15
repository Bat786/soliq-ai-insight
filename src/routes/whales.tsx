import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Waves } from "lucide-react";

import { AppShell } from "@/components/soliq/AppShell";
import { TierGate } from "@/components/soliq/TierGate";
import { BullBearGauge } from "@/components/soliq/BullBearGauge";
import { WhaleAlerts } from "@/components/soliq/WhaleAlerts";
import { SectionTitle } from "@/components/soliq/primitives";
import { fmtBig, TideSpark } from "@/components/soliq/WhaleSignal";
import { useWhaleFeed } from "@/hooks/use-whales";

export const Route = createFileRoute("/whales")({
  head: () => ({
    meta: [
      { title: "Whale Flow Dashboard — institutional options & dark pool tape | SOLIQ" },
      {
        name: "description",
        content:
          "Live institutional whale flow: market tide net premium, dark pool prints, unusual options alerts, sector tilt and bullish/bearish conviction scoring.",
      },
      { property: "og:title", content: "SOLIQ Whale Flow Dashboard" },
      {
        property: "og:description",
        content: "Market tide, dark pool prints and unusual options alerts scored into a live bull/bear signal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <TierGate feature="whaleFlow" shell>
      <WhalesPage />
    </TierGate>
  ),
});

const time = (t: number) =>
  new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Metric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="panel p-3">
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`num mt-1 text-sm font-medium ${tone}`}>{value}</p>
    </div>
  );
}

function WhalesPage() {
  const { data, isLoading, isError, error } = useWhaleFeed();

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading institutional whale tape…
        </div>
      </AppShell>
    );
  }
  if (isError || !data) {
    return (
      <AppShell>
        <p className="py-24 text-center text-sm text-bear">
          {(error as Error)?.message ?? "Whale feed unavailable"}
        </p>
      </AppShell>
    );
  }

  const s = data.signal;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Waves className="size-5 text-primary" /> Whale Flow
            </h1>
            <p className="text-sm text-muted-foreground">
              Institutional options tide, dark pool prints and unusual activity — powered by Unusual Whales.
            </p>
          </div>
          <p className="num text-[11px] text-muted-foreground">
            updated {time(data.updatedAt)} · auto-refresh 60s
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="panel p-4">
            <SectionTitle title="Market tide" subtitle="Net call premium minus net put premium, intraday" />
            <TideSpark points={data.tide} />
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <Metric
                label="Net premium"
                value={fmtBig(s.netPremium)}
                tone={s.netPremium >= 0 ? "text-bull" : "text-bear"}
              />
              <Metric label="Call premium" value={fmtBig(s.callPremium)} tone="text-bull" />
              <Metric label="Put premium" value={fmtBig(s.putPremium)} tone="text-bear" />
              <Metric
                label="Net options volume"
                value={Math.round(s.netVolume).toLocaleString("en-US")}
                tone={s.netVolume >= 0 ? "text-bull" : "text-bear"}
              />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">{s.headline}</p>
          </div>

          <div className="panel p-4">
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Whale conviction</p>
            <p
              className={`font-display mt-1 text-xl font-semibold ${
                s.tilt > 0.12 ? "text-bull" : s.tilt < -0.12 ? "text-bear" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </p>
            <div className="mt-3">
              <BullBearGauge bull={s.bull} bear={s.bear} confidence={s.confidence} whaleBull={s.bull} compact />
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <p className="flex justify-between">
                <span className="text-muted-foreground">Put / call premium</span>
                <span className="num">{s.putCallRatio.toFixed(2)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">Flow alerts scanned</span>
                <span className="num">{data.alerts.length}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">Dark pool prints</span>
                <span className="num">{data.darkpool.length}</span>
              </p>
            </div>
          </div>
        </div>

        <WhaleAlerts />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel p-4">
            <SectionTitle title="Unusual options alerts" subtitle="Largest premium prints hitting the tape" />
            <div className="max-h-96 overflow-y-auto">
              {data.alerts.map((a) => {
                const bullish = a.askSidePrem >= a.bidSidePrem;
                return (
                  <div key={a.id} className="flex items-center gap-3 border-b border-border/60 py-2 last:border-0">
                    <span className="num w-16 shrink-0 text-xs font-medium">{a.ticker}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px]">{a.rule}</p>
                      <p className="num text-[10px] text-muted-foreground">
                        strike {a.strike || "—"} · {a.size.toLocaleString("en-US")} contracts · {time(a.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="num text-xs">{fmtBig(a.premium)}</p>
                      <p className={`text-[10px] ${bullish ? "text-bull" : "text-bear"}`}>
                        {bullish ? "ask-side" : "bid-side"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel p-4">
            <SectionTitle title="Dark pool tape" subtitle="Off-exchange blocks by notional premium" />
            <div className="max-h-96 overflow-y-auto">
              {data.darkpool.map((p, i) => (
                <div
                  key={`${p.ticker}-${p.executedAt}-${i}`}
                  className="flex items-center gap-3 border-b border-border/60 py-2 last:border-0"
                >
                  <span className="num w-16 shrink-0 text-xs font-medium">{p.ticker}</span>
                  <div className="min-w-0 flex-1">
                    <p className="num text-[11px]">
                      {p.size.toLocaleString("en-US")} @ ${p.price.toFixed(2)}
                    </p>
                    <p className="num text-[10px] text-muted-foreground">
                      {time(p.executedAt)}
                      {p.extendedHours ? " · extended hours" : ""}
                    </p>
                  </div>
                  <p className="num shrink-0 text-xs">{fmtBig(p.premium)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel p-4">
            <SectionTitle title="Net premium impact" subtitle="Where whales are pressing hardest" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] tracking-wide text-bull uppercase">Bullish</p>
                {data.netImpact.bullish.map((r) => (
                  <p key={r.ticker} className="num flex justify-between border-b border-border/60 py-1.5 text-xs last:border-0">
                    <span>{r.ticker}</span>
                    <span className="text-bull">{fmtBig(r.netPremium)}</span>
                  </p>
                ))}
              </div>
              <div>
                <p className="text-[10px] tracking-wide text-bear uppercase">Bearish</p>
                {data.netImpact.bearish.map((r) => (
                  <p key={r.ticker} className="num flex justify-between border-b border-border/60 py-1.5 text-xs last:border-0">
                    <span>{r.ticker}</span>
                    <span className="text-bear">{fmtBig(r.netPremium)}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="panel p-4">
            <SectionTitle title="Sector heat" subtitle="Sector ETF option premium tilt" />
            <div className="grid gap-1.5">
              {data.sectors.map((sec) => {
                const pct = Math.round((sec.tilt + 1) * 50);
                return (
                  <div key={sec.ticker} className="flex items-center gap-2">
                    <span className="num w-12 shrink-0 text-[11px] font-medium">{sec.ticker}</span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`absolute inset-y-0 rounded-full ${sec.tilt >= 0 ? "bg-bull left-1/2" : "bg-bear right-1/2"}`}
                        style={{ width: `${Math.abs(sec.tilt) * 50}%` }}
                      />
                    </div>
                    <span className={`num w-14 shrink-0 text-right text-[10px] ${sec.tilt >= 0 ? "text-bull" : "text-bear"}`}>
                      {pct}% bull
                    </span>
                    <span className="num hidden w-16 shrink-0 text-right text-[10px] text-muted-foreground sm:block">
                      {fmtBig(sec.netPremium)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel p-4">
          <SectionTitle title="Dark pool leaders" subtitle="Aggregated block notional by ticker" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {data.darkpoolTop.map((r) => (
              <div key={r.ticker} className="rounded-xl bg-surface-2/50 p-3">
                <p className="num text-sm font-medium">{r.ticker}</p>
                <p className="num text-xs text-muted-foreground">{fmtBig(r.premium)}</p>
                <p className="num text-[10px] text-muted-foreground">{r.prints} prints</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Whale flow data is institutional US options and dark pool activity from Unusual Whales. Informational only —
          not financial advice.
        </p>
      </div>
    </AppShell>
  );
}
