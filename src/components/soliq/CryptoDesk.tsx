import { useMemo, useState } from "react";
import { Droplets, Flame, Loader2, Rocket, Search, ShieldCheck, Sparkles, Users } from "lucide-react";

import { BullBearGauge } from "@/components/soliq/BullBearGauge";
import { Delta, SectionTitle } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCryptoDesk, useDexSearch } from "@/hooks/use-dex";
import type { DexTf, TokenRow } from "@/lib/dex.server";

const TFS: DexTf[] = ["5m", "1h", "6h", "24h"];

const compact = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
  : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M`
  : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K`
  : `$${n.toFixed(0)}`;

const px = (n: number) =>
  n === 0 ? "—"
  : n >= 1 ? `$${n.toFixed(4)}`
  : n >= 0.0001 ? `$${n.toFixed(6)}`
  : `$${n.toExponential(2)}`;

const tone = (t: number) => (t > 0.12 ? "text-bull" : t < -0.12 ? "text-bear" : "text-muted-foreground");

const age = (ms: number) => {
  if (!ms) return "—";
  const m = Math.max(0, Date.now() - ms) / 60_000;
  return m < 60 ? `${m.toFixed(0)}m` : m < 1440 ? `${(m / 60).toFixed(1)}h` : `${(m / 1440).toFixed(0)}d`;
};

function VerdictPill({ row }: { row: TokenRow }) {
  const cls =
    row.verdict === "buy" ? "border-bull/50 text-bull"
    : row.verdict === "sell" ? "border-bear/50 text-bear"
    : "border-border text-muted-foreground";
  return (
    <span className={`num rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase ${cls}`}>
      {row.verdict} · {row.score}
    </span>
  );
}

function TokenCard({ row, tf }: { row: TokenRow; tf: DexTf }) {
  const sig = row.signals.find((s) => s.tf === tf) ?? row.signals[0];
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {row.icon ? (
            <img src={row.icon} alt={`${row.symbol} logo`} loading="lazy" className="size-8 rounded-full bg-surface-2" />
          ) : (
            <div className="grid size-8 place-items-center rounded-full bg-surface-2 text-[10px]">{row.symbol.slice(0, 3)}</div>
          )}
          <div className="min-w-0">
            <p className="num flex items-center gap-1 text-sm font-semibold">
              {row.symbol}
              {row.verified && <ShieldCheck className="size-3 text-primary" />}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{row.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="num text-sm">{px(row.price)}</p>
          <Delta value={row.changePct} />
        </div>
      </div>

      <div className="mt-3">
        <BullBearGauge bull={sig?.bull ?? 50} bear={sig?.bear ?? 50} confidence={sig?.confidence} compact whaleBull={row.buyPressure} />
      </div>

      <div className="num mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className={tone(sig?.tilt ?? 0)}>{sig?.label ?? "No tape"}</span>
        <VerdictPill row={row} />
      </div>

      <div className="num mt-2 grid grid-cols-2 gap-1.5 text-[10px] sm:grid-cols-4">
        <div className="rounded-lg bg-surface-2/50 p-2">
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Mcap</p>
          <p>{compact(row.mcap || row.fdv)}</p>
        </div>
        <div className="rounded-lg bg-surface-2/50 p-2">
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Liquidity</p>
          <p>{compact(row.liquidity)}</p>
        </div>
        <div className="rounded-lg bg-surface-2/50 p-2">
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Vol {tf}</p>
          <p>{compact(sig?.volume ?? 0)}</p>
        </div>
        <div className="rounded-lg bg-surface-2/50 p-2">
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Holders</p>
          <p>{row.holders >= 1000 ? `${(row.holders / 1000).toFixed(1)}K` : row.holders}</p>
        </div>
      </div>

      <div className="num mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Sparkles className="size-3 text-primary" /> organic {row.organicScore.toFixed(0)} · {row.organicLabel}
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3" /> net buyers {row.netBuyers}
        </span>
        <span>age {age(row.createdAt)}</span>
        <span className={row.audit.mintDisabled && row.audit.freezeDisabled ? "text-bull" : "text-bear"}>
          {row.audit.mintDisabled && row.audit.freezeDisabled ? "mint+freeze off" : "authority live"}
        </span>
        <a
          href={`https://jup.ag/tokens/${row.mint}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-primary hover:underline"
        >
          Jupiter ↗
        </a>
      </div>
    </div>
  );
}

/** Solana-first DEX intelligence desk: Jupiter organic flow + DexScreener metas. */
export function CryptoDesk() {
  const { data, isLoading, isError, error } = useCryptoDesk();
  const [tf, setTf] = useState<DexTf>("1h");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const search = useDexSearch(submitted);

  const movers = useMemo(() => {
    const rows = [...(data?.movers ?? [])];
    return rows.sort((a, b) => {
      const at = a.signals.find((s) => s.tf === tf)?.tilt ?? 0;
      const bt = b.signals.find((s) => s.tf === tf)?.tilt ?? 0;
      return bt - at;
    });
  }, [data?.movers, tf]);

  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-center gap-3 px-3 py-2 text-[11px]">
        <Droplets className="size-3.5 text-primary" />
        <span className="text-muted-foreground">DEX tape</span>
        <span className="text-foreground">Jupiter organic flow · DexScreener metas</span>
        <div className="ml-auto flex items-center gap-1">
          {TFS.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tf === t ? "subtle" : "ghost"}
              onClick={() => setTf(t)}
              className="h-7 px-2 text-[11px]"
            >
              {t.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading Solana DEX flow…
        </div>
      )}
      {isError && <p className="py-16 text-center text-sm text-bear">{(error as Error)?.message ?? "Feed unavailable"}</p>}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any pair or token — BONK, WIF, SOL/USDC, or a mint address"
          className="num"
        />
        <Button type="submit" variant="subtle" className="gap-1.5">
          <Search className="size-3.5" /> Search
        </Button>
      </form>

      {submitted.length >= 2 && (
        <div className="panel p-4">
          <SectionTitle title={`Pairs matching “${submitted}”`} subtitle="DexScreener liquidity-ranked results" />
          {search.isLoading && (
            <p className="num py-6 text-center text-[11px] text-muted-foreground">searching DEX pairs…</p>
          )}
          {search.data && search.data.length === 0 && (
            <p className="num py-6 text-center text-[11px] text-muted-foreground">no pairs found</p>
          )}
          <div className="mt-2 divide-y divide-border/60">
            {(search.data ?? []).map((p) => (
              <a
                key={p.pairAddress}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 py-2 text-[11px] transition-colors hover:bg-surface-2/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="num font-semibold">
                    {p.symbol}/{p.quote} <span className="text-muted-foreground">· {p.dexId} · {p.chainId}</span>
                  </p>
                  <p className="truncate text-muted-foreground">{p.name}</p>
                </div>
                <p className="num w-20 text-right">{px(p.priceUsd)}</p>
                <div className="w-16 text-right">
                  <Delta value={p.change24h} />
                </div>
                <p className="num w-20 text-right text-muted-foreground">liq {compact(p.liquidity)}</p>
                <p className="num w-20 text-right text-muted-foreground">vol {compact(p.volume24h)}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {movers.length > 0 && (
        <div className="space-y-2">
          <SectionTitle
            title="Organic flow leaders"
            subtitle={`Ranked by ${tf} buy/sell pressure, order tilt and liquidity shift`}
          />
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {movers.slice(0, 12).map((r) => (
              <TokenCard key={r.mint} row={r} tf={tf} />
            ))}
          </div>
        </div>
      )}

      {(data?.metas.length ?? 0) > 0 && (
        <div className="space-y-2">
          <SectionTitle title="Trending metas" subtitle="Narrative rotation across DEX sectors" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data?.metas.map((m) => (
              <div key={m.slug} className="panel p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    <span className="mr-1.5">{m.emoji}</span>
                    {m.name}
                  </p>
                  <Delta value={m.change24h} />
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{m.description}</p>
                <div className="num mt-2 flex justify-between text-[10px] text-muted-foreground">
                  <span>mcap {compact(m.marketCap)}</span>
                  <span>vol {compact(m.volume)}</span>
                  <span>{m.tokenCount} tokens</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data?.fresh.length ?? 0) > 0 && (
        <div className="space-y-2">
          <SectionTitle title="Fresh launches" subtitle="Newest Jupiter-indexed mints — highest risk, verify everything" />
          <div className="panel divide-y divide-border/60 p-2">
            {data?.fresh.slice(0, 12).map((r) => (
              <div key={r.mint} className="flex items-center gap-3 px-2 py-2 text-[11px]">
                <Rocket className="size-3 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="num font-semibold">{r.symbol}</p>
                  <p className="truncate text-muted-foreground">{r.name}</p>
                </div>
                <p className="num w-20 text-right">{px(r.price)}</p>
                <p className="num w-20 text-right text-muted-foreground">liq {compact(r.liquidity)}</p>
                <p className="num w-16 text-right text-muted-foreground">age {age(r.createdAt)}</p>
                <p className={`num w-24 text-right ${tone((r.signals[0]?.tilt ?? 0))}`}>
                  {(r.signals.find((s) => s.tf === "5m")?.bull ?? 50)}% bull
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data?.profiles.length ?? 0) > 0 && (
        <div className="space-y-2">
          <SectionTitle title="New token profiles" subtitle="Projects that just published socials and docs on DexScreener" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data?.profiles.slice(0, 9).map((p) => (
              <a
                key={`${p.chainId}-${p.tokenAddress}`}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="panel p-3 transition-colors hover:border-primary/30"
              >
                <div className="flex items-center gap-2">
                  {p.icon ? (
                    <img src={p.icon} alt="" loading="lazy" className="size-7 rounded-full bg-surface-2" />
                  ) : null}
                  <p className="num truncate text-[11px] font-semibold">{p.tokenAddress.slice(0, 6)}…{p.tokenAddress.slice(-4)}</p>
                  <span className="num ml-auto text-[10px] text-muted-foreground">{p.chainId}</span>
                </div>
                {p.description && <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">{p.description}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-primary">
                  {p.links.map((l) => (
                    <span key={l.url}>{l.label}</span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {(data?.notes.length ?? 0) > 0 && (
        <p className="num text-[10px] text-muted-foreground">{data?.notes.join(" · ")}</p>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Flame className="mt-0.5 size-3 shrink-0" />
        Jupiter organic-score flow and DexScreener pair data refresh every 45 seconds. On-chain markets are extremely
        volatile — informational only, not financial advice.
      </p>
    </div>
  );
}
