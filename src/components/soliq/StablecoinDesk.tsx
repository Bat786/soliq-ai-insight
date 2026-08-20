import { useWallet } from "@solana/wallet-adapter-react";
import { Coins, Landmark, Loader2, ShieldCheck } from "lucide-react";

import { Delta, SectionTitle, Sparkline } from "@/components/soliq/primitives";
import { useStablecoinBalances, useStablecoinDesk } from "@/hooks/use-stablecoins";
import type { StablecoinRow } from "@/lib/stablecoins.server";

const compact = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
  : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M`
  : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K`
  : `$${n.toFixed(0)}`;

const units = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B`
  : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K`
  : n.toFixed(2);

const statusCls: Record<StablecoinRow["status"], string> = {
  stable: "border-bull/50 text-bull",
  drift: "border-primary/50 text-primary",
  broken: "border-bear/50 text-bear",
  "no-data": "border-border text-muted-foreground",
};

function PegBadge({ row }: { row: StablecoinRow }) {
  return (
    <span className={`num rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase ${statusCls[row.status]}`}>
      {row.status === "no-data" ? "no quote" : `${row.pegBps >= 0 ? "+" : ""}${row.pegBps.toFixed(1)} bps`}
    </span>
  );
}

function StableCard({ row }: { row: StablecoinRow }) {
  const up = row.pegBps >= 0;
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="num flex items-center gap-1 text-sm font-semibold">
            {row.symbol}
            <ShieldCheck className="size-3 text-primary" />
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{row.name}</p>
        </div>
        <div className="text-right">
          <p className="num text-sm">{row.price ? `$${row.price.toFixed(4)}` : "—"}</p>
          <Delta value={row.change24h} />
        </div>
      </div>

      <div className="mt-2">
        <Sparkline data={row.series} up={up} />
      </div>

      <div className="num mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>peg ${row.peg.toFixed(2)} · {row.pair}</span>
        <PegBadge row={row} />
      </div>

      <div className="num mt-2 grid grid-cols-2 gap-1.5 text-[10px] sm:grid-cols-4">
        <div className="rounded-lg bg-surface-2/50 p-2">
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Vol 24h</p>
          <p>{row.volume24h ? compact(row.volume24h) : "—"}</p>
        </div>
        <div className="rounded-lg bg-surface-2/50 p-2">
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Range</p>
          <p>{row.low24h ? `${row.low24h.toFixed(4)}–${row.high24h.toFixed(4)}` : "—"}</p>
        </div>
        <div className="rounded-lg bg-surface-2/50 p-2">
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">Worst drift</p>
          <p>{row.worstBps.toFixed(1)} bps</p>
        </div>
        <div className="rounded-lg bg-surface-2/50 p-2">
          <p className="text-[9px] tracking-wide text-muted-foreground uppercase">On-chain supply</p>
          <p>{row.onchainSupply === null ? "—" : units(row.onchainSupply)}</p>
        </div>
      </div>

      {row.mint && (
        <p className="num mt-1.5 truncate text-[10px] text-muted-foreground">
          mint {row.mint.slice(0, 6)}…{row.mint.slice(-4)}
          {row.onchainCap ? ` · on-chain cap ${compact(row.onchainCap)}` : ""}
        </p>
      )}
    </div>
  );
}

/** Peg/market intelligence for stablecoins: Massive market data + Alchemy on-chain supply and balances. */
export function StablecoinDesk() {
  const { data, isLoading, isError, error } = useStablecoinDesk();
  const { publicKey } = useWallet();
  const owner = publicKey?.toBase58() ?? null;
  const balances = useStablecoinBalances(owner);

  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-center gap-3 px-3 py-2 text-[11px]">
        <Coins className="size-3.5 text-primary" />
        <span className="text-muted-foreground">Peg tape</span>
        <span className="text-foreground">Massive market data · Alchemy on-chain supply</span>
        <span className="num ml-auto text-muted-foreground">cluster {data?.network ?? "devnet"}</span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading stablecoin peg data…
        </div>
      )}
      {isError && <p className="py-16 text-center text-sm text-bear">{(error as Error)?.message ?? "Feed unavailable"}</p>}

      {data && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="panel p-3">
              <p className="text-[10px] tracking-wide text-muted-foreground uppercase">On-chain cap tracked</p>
              <p className="num text-lg">{compact(data.totals.onchainCap)}</p>
            </div>
            <div className="panel p-3">
              <p className="text-[10px] tracking-wide text-muted-foreground uppercase">24h volume</p>
              <p className="num text-lg">{compact(data.totals.volume24h)}</p>
            </div>
            <div className="panel p-3">
              <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Quoted stablecoins</p>
              <p className="num text-lg">
                {data.totals.tracked}/{data.rows.length}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <SectionTitle title="Peg monitor" subtitle="Deviation from peg in basis points, 30-day drift and 24h tape" />
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {data.rows.map((r) => (
                <StableCard key={r.symbol} row={r} />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="space-y-2">
        <SectionTitle
          title="Your on-chain stablecoin balances"
          subtitle="SPL token accounts read through our Alchemy Solana node"
        />
        <div className="panel p-3 text-[11px]">
          {!owner && <p className="text-muted-foreground">Connect a Solana wallet to read live token balances.</p>}
          {owner && balances.isLoading && <p className="text-muted-foreground">reading token accounts…</p>}
          {owner && balances.data && balances.data.balances.length === 0 && (
            <p className="text-muted-foreground">No tracked stablecoin mints found on this cluster.</p>
          )}
          {owner && balances.data && balances.data.balances.length > 0 && (
            <div className="divide-y divide-border/60">
              {balances.data.balances.map((b) => (
                <div key={b.mint} className="flex items-center gap-3 py-2">
                  <Landmark className="size-3 text-primary" />
                  <p className="num flex-1 font-semibold">{b.symbol}</p>
                  <p className="num w-24 text-right">{units(b.amount)}</p>
                  <p className="num w-24 text-right text-muted-foreground">{b.accounts} account(s)</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(data?.notes.length ?? 0) > 0 && (
        <p className="num text-[10px] text-muted-foreground">{data?.notes.join(" · ")}</p>
      )}

      <p className="text-[11px] text-muted-foreground">
        Peg data refreshes every 60 seconds from Massive; supply and balances come straight from the Alchemy Solana node.
        Informational only, not financial advice.
      </p>
    </div>
  );
}
