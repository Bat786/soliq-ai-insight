import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/soliq/AppShell";
import { ProjectionPanel } from "@/components/soliq/ProjectionPanel";
import { BullBearGauge } from "@/components/soliq/BullBearGauge";
import { ChartTerminal } from "@/components/soliq/ChartTerminal";
import { RiskBar, ScoreRing } from "@/components/soliq/primitives";
import { Delta } from "@/components/soliq/primitives";
import { WhaleSignalCard } from "@/components/soliq/WhaleSignal";
import { useAssetDetail } from "@/hooks/use-market";
import { useWhaleFeed } from "@/hooks/use-whales";
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
  const { data: whales } = useWhaleFeed();

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

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <ChartTerminal
            points={history.prices}
            volumes={history.volumes}
            price={asset.price}
            symbol={asset.symbol}
            days={days}
            onDaysChange={setDays}
          />
          <div className="space-y-4">
            <BullBearGauge
              bull={asset.bullScore}
              bear={asset.bearScore}
              confidence={asset.aiConfidence}
              whaleBull={whales?.signal.bull}
            />
            <WhaleSignalCard compact />
            <div className="panel p-4">
              <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Flow &amp; pressure</p>
              <div className="mt-2 space-y-2 text-xs">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Buy pressure</span>
                  <span className="num text-bull">{asset.buyPressure}%</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Sell pressure</span>
                  <span className="num text-bear">{asset.sellPressure}%</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Rel volume</span>
                  <span className="num">{asset.relVolume}x</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Smart money</span>
                  <span className="num">{asset.onchain.smartMoney}/100</span>
                </p>
              </div>
            </div>
          </div>
        </div>


        {forecast ? (
          <ProjectionPanel projection={forecast} title="SOLIQ price projection" note={asset.thesis} />
        ) : (
          <div className="panel p-4">
            <p className="text-xs font-medium">Memecoin analytics</p>
            <p className="mt-1 text-xs text-muted-foreground">{asset.thesis}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              SOLIQ deliberately publishes no future-price projection for memecoins — momentum, liquidity, sentiment and
              risk analytics only.
            </p>
          </div>
        )}

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
