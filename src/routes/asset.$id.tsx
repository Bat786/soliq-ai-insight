import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/soliq/AppShell";
import { Delta, RiskBar, ScoreRing } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { useAssetDetail } from "@/hooks/use-market";
import { fmtPctc, fmtUsdc, sectorLabels, signalLabels } from "@/lib/market-types";

export const Route = createFileRoute("/asset/$id")({
  head: ({ params }) => {
    const label = params.id.replace(/-/g, " ");
    return {
      meta: [
        { title: `${label} analysis & AI forecast — SOLIQ` },
        {
          name: "description",
          content: `Live ${label} price chart, RSI, MACD, moving averages, volume flow, whale activity and SOLIQ AI price projection.`,
        },
        { property: "og:title", content: `${label} analysis — SOLIQ` },
        { property: "og:description", content: `Live chart, indicators and AI projection for ${label}.` },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: AssetPage,
});

const ranges = [
  { label: "7D", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3">
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="num mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function AssetPage() {
  const { id } = Route.useParams();
  const [days, setDays] = useState(90);
  const { data, isLoading, isError, error } = useAssetDetail(id, days);

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading live analysis…
        </div>
      </AppShell>
    );
  }
  if (isError || !data) {
    return (
      <AppShell>
        <p className="py-24 text-center text-sm text-bear">{(error as Error)?.message ?? "Asset unavailable"}</p>
      </AppShell>
    );
  }

  const { asset, history, forecast } = data;
  const i = asset.indicators;
  const chart = history.prices.map((p) => ({ t: p.t, price: p.p }));

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <img src={asset.image} alt={`${asset.name} logo`} className="size-10 rounded-full bg-surface-2" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {asset.name} <span className="num text-sm text-muted-foreground">{asset.symbol}</span>
            </h1>
            <p className="num text-sm">
              {fmtUsdc(asset.price)} <Delta value={asset.change24h} className="ml-2" />
              <span className="ml-2 text-[11px] text-muted-foreground">
                {sectorLabels[asset.sector]} · rank #{asset.rank}
              </span>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ScoreRing score={asset.aiScore} />
            <RiskBar risk={asset.riskScore} />
          </div>
        </div>

        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium">Price history</p>
            <div className="flex gap-1">
              {ranges.map((r) => (
                <Button key={r.days} size="sm" variant={days === r.days ? "subtle" : "ghost"} onClick={() => setDays(r.days)}>
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="t"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => fmtUsdc(v)}
                  width={64}
                />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                  labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
                  formatter={(v: number) => [fmtUsdc(v), "Price"]}
                />
                <Area type="monotone" dataKey="price" stroke="var(--primary)" strokeWidth={2} fill="url(#pg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <p className="text-xs font-medium">AI projection</p>
          <p className="mt-1 text-xs text-muted-foreground">{asset.thesis}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {forecast.map((f) => (
              <div key={f.label} className="rounded-xl bg-surface-2/50 p-3">
                <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{f.label} target</p>
                <p className="num text-sm font-medium">{fmtUsdc(f.target)}</p>
                <p className={`num text-[11px] ${f.changePct >= 0 ? "text-bull" : "text-bear"}`}>{fmtPctc(f.changePct)}</p>
                <p className="num mt-1 text-[10px] text-muted-foreground">
                  range {fmtUsdc(f.low)}–{fmtUsdc(f.high)} · {f.confidence}% confidence
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Projections are a transparent trend + mean-reversion model with volatility bands. Not financial advice.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Market cap" value={fmtUsdc(asset.marketCap)} />
          <Stat label="24h volume" value={fmtUsdc(asset.volume24h)} />
          <Stat label="Rel volume" value={`${asset.relVolume}x`} />
          <Stat label="RSI (14)" value={String(i.rsi)} />
          <Stat label="MACD hist" value={String(i.macdHist)} />
          <Stat label="ADX" value={String(i.adx)} />
          <Stat label="EMA 20 / 50" value={`${fmtUsdc(i.ema20)} / ${fmtUsdc(i.ema50)}`} />
          <Stat label="SMA 50" value={fmtUsdc(i.sma50)} />
          <Stat label="VWAP (24)" value={fmtUsdc(i.vwap)} />
          <Stat label="Bollinger" value={`${fmtUsdc(i.bbLower)}–${fmtUsdc(i.bbUpper)}`} />
          <Stat label="ATR" value={fmtUsdc(i.atr)} />
          <Stat label="Volatility" value={`${i.volatility}%`} />
          <Stat label="Support" value={fmtUsdc(i.support)} />
          <Stat label="Resistance" value={fmtUsdc(i.resistance)} />
          <Stat label="Bull / Bear" value={`${asset.bullScore} / ${asset.bearScore}`} />
          <Stat label="Buy / sell pressure" value={`${asset.buyPressure}% / ${asset.sellPressure}%`} />
          <Stat label="Liquidity" value={fmtUsdc(asset.onchain.liquidity)} />
          <Stat label="Holders" value={asset.onchain.holders.toLocaleString()} />
          <Stat label="Whale accumulation" value={`${asset.onchain.whaleAccumulation}/100`} />
          <Stat label="Whale selling" value={`${asset.onchain.whaleSelling}/100`} />
          <Stat label="Smart money" value={`${asset.onchain.smartMoney}/100`} />
          <Stat label="Wallet concentration" value={`${asset.onchain.topWalletConcentration}%`} />
          <Stat label="DEX / CEX volume" value={`${fmtUsdc(asset.onchain.dexVolume)} / ${fmtUsdc(asset.onchain.cexVolume)}`} />
          <Stat label="Social / news" value={`${asset.sentiment.social} / ${asset.sentiment.news}`} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(signalLabels) as (keyof typeof signalLabels)[])
            .filter((k) => asset.signals[k])
            .map((k) => (
              <span key={k} className="rounded-md bg-primary/12 px-2 py-0.5 text-[11px] text-primary">
                {signalLabels[k]}
              </span>
            ))}
        </div>
      </div>
    </AppShell>
  );
}
