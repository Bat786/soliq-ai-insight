import { useMemo, useState } from "react";
import { Building2, Loader2, Scale, Search, SquareStack } from "lucide-react";

import { SectionTitle } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEquityResearch, useEquityUniverse } from "@/hooks/use-equity";
import { fmtNum, fmtUsd } from "@/lib/format";
import type { FinancialPeriod, OptionContract } from "@/lib/equity.server";

const money = (n: number | null) => (n === null ? "—" : fmtUsd(n));

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-2.5">
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="num mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function Statements({ rows, title }: { rows: FinancialPeriod[]; title: string }) {
  if (!rows.length) return null;
  return (
    <div className="scroll-none mt-3 overflow-x-auto">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <table className="mt-2 w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-left text-[10px] tracking-wide text-muted-foreground uppercase">
            <th className="pb-2 font-medium">Period</th>
            <th className="pb-2 text-right font-medium">Revenue</th>
            <th className="pb-2 text-right font-medium">Gross profit</th>
            <th className="pb-2 text-right font-medium">Operating income</th>
            <th className="pb-2 text-right font-medium">Net income</th>
            <th className="pb-2 text-right font-medium">EPS</th>
            <th className="pb-2 text-right font-medium">Assets</th>
            <th className="pb-2 text-right font-medium">Liabilities</th>
            <th className="pb-2 text-right font-medium">Equity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.fiscalYear}-${r.period}-${r.end}`} className="border-t border-border/60">
              <td className="num py-2.5">
                {r.fiscalYear} {r.period}
                <span className="ml-1 text-[10px] text-muted-foreground">{r.end}</span>
              </td>
              <td className="num py-2.5 text-right">{money(r.revenue)}</td>
              <td className="num py-2.5 text-right">{money(r.grossProfit)}</td>
              <td className="num py-2.5 text-right">{money(r.operatingIncome)}</td>
              <td className={`num py-2.5 text-right ${(r.netIncome ?? 0) >= 0 ? "text-bull" : "text-bear"}`}>
                {money(r.netIncome)}
              </td>
              <td className="num py-2.5 text-right">{r.eps === null ? "—" : r.eps.toFixed(2)}</td>
              <td className="num py-2.5 text-right">{money(r.assets)}</td>
              <td className="num py-2.5 text-right">{money(r.liabilities)}</td>
              <td className="num py-2.5 text-right">{money(r.equity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChainRow({ c }: { c: OptionContract }) {
  return (
    <tr className="border-t border-border/60">
      <td className={`num py-2 ${c.type === "call" ? "text-bull" : "text-bear"}`}>{c.type.toUpperCase()}</td>
      <td className="num py-2 text-right">{c.strike.toFixed(2)}</td>
      <td className="num py-2 text-right">{c.last === null ? "—" : c.last.toFixed(2)}</td>
      <td className="num py-2 text-right">
        {c.bid === null ? "—" : c.bid.toFixed(2)} / {c.ask === null ? "—" : c.ask.toFixed(2)}
      </td>
      <td className="num py-2 text-right">{fmtNum(c.volume)}</td>
      <td className="num py-2 text-right">{fmtNum(c.openInterest)}</td>
      <td className="num py-2 text-right">{c.iv === null ? "—" : `${(c.iv * 100).toFixed(1)}%`}</td>
      <td className="num py-2 text-right">{c.delta === null ? "—" : c.delta.toFixed(3)}</td>
      <td className="num py-2 text-right">{c.breakEven === null ? "—" : c.breakEven.toFixed(2)}</td>
    </tr>
  );
}

/** Full company research desk: profile, balance sheet, income statement and live options chain. */
export function StockResearch({ initial = "AAPL" }: { initial?: string }) {
  const [ticker, setTicker] = useState(initial);
  const [term, setTerm] = useState("");
  const research = useEquityResearch(ticker);
  const universe = useEquityUniverse(term);
  const [expiry, setExpiry] = useState<string | null>(null);

  const options = research.data?.options;
  const activeExpiry = expiry && options?.expiries.includes(expiry) ? expiry : options?.expiries[0] ?? null;
  const chain = useMemo(() => {
    if (!options || !activeExpiry) return [];
    return options.contracts
      .filter((c) => c.expiry === activeExpiry)
      .sort((a, b) => a.strike - b.strike || a.type.localeCompare(b.type))
      .slice(0, 120);
  }, [options, activeExpiry]);

  const p = research.data?.profile;
  const hits = term.trim().length >= 1 ? (universe.data ?? []).slice(0, 24) : [];

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <SectionTitle
          title="Company research"
          subtitle="Every listed ticker — profile, filings, balance sheet and live options"
          action={<Building2 className="size-4 text-primary" />}
        />
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search the full US listing universe (name or ticker)…"
              className="h-9 pl-8"
            />
          </div>
          <Input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            className="num h-9 w-28"
            aria-label="Active ticker"
          />
        </div>
        {hits.length > 0 && (
          <div className="scroll-none mt-3 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
            {hits.map((h) => (
              <button
                key={h.ticker}
                type="button"
                onClick={() => {
                  setTicker(h.ticker);
                  setExpiry(null);
                }}
                title={`${h.name} · ${h.exchange}`}
                className={`num rounded-full border px-2.5 py-1 text-[11px] transition ${
                  h.ticker === ticker
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {h.ticker}
              </button>
            ))}
          </div>
        )}
      </div>

      {research.isLoading ? (
        <div className="panel flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Pulling filings and options for {ticker}…
        </div>
      ) : (
        <>
          <div className="panel p-5">
            <div className="flex flex-wrap items-center gap-3">
              {p?.logo && <img src={`${p.logo}`} alt="" className="size-8 rounded-lg bg-surface-2" loading="lazy" />}
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold">
                  {p?.name ?? ticker} <span className="num text-xs text-muted-foreground">{ticker}</span>
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {p?.exchange ?? "—"} · {p?.sic ?? "sector n/a"}
                  {p?.listDate ? ` · listed ${p.listDate}` : ""}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Market cap" value={money(p?.marketCap ?? null)} />
              <Stat label="Shares out" value={p?.shares ? fmtNum(p.shares) : "—"} />
              <Stat label="Employees" value={p?.employees ? fmtNum(p.employees) : "—"} />
              <Stat label="Spot" value={options?.spot ? options.spot.toFixed(2) : "—"} />
              <Stat label="Put/call vol" value={options?.putCallRatio === null || options === undefined ? "—" : String(options.putCallRatio)} />
            </div>
            {p?.description && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{p.description}</p>}
          </div>

          <div className="panel p-5">
            <SectionTitle
              title="Financials & balance sheet"
              subtitle="Filed statements, most recent first"
              action={<Scale className="size-4 text-primary" />}
            />
            <Statements rows={research.data?.quarterly ?? []} title="Quarterly" />
            <Statements rows={research.data?.annual ?? []} title="Annual" />
            {!research.data?.quarterly.length && !research.data?.annual.length && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No filed statements returned for {ticker} on the current data plan.
              </p>
            )}
          </div>

          <div className="panel p-5">
            <SectionTitle
              title="Options chain"
              subtitle={
                options?.available
                  ? `${fmtNum(options.callVolume)} call vs ${fmtNum(options.putVolume)} put volume · OI ${fmtNum(
                      options.callOi,
                    )} / ${fmtNum(options.putOi)}`
                  : "Live contracts, greeks and open interest"
              }
              action={<SquareStack className="size-4 text-primary" />}
            />
            {options?.expiries.length ? (
              <>
                <div className="scroll-none flex gap-1.5 overflow-x-auto pb-1">
                  {options.expiries.slice(0, 12).map((e) => (
                    <Button
                      key={e}
                      size="sm"
                      variant={e === activeExpiry ? "hero" : "subtle"}
                      onClick={() => setExpiry(e)}
                      className="num shrink-0"
                    >
                      {e}
                    </Button>
                  ))}
                </div>
                <div className="scroll-none mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="text-left text-[10px] tracking-wide text-muted-foreground uppercase">
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 text-right font-medium">Strike</th>
                        <th className="pb-2 text-right font-medium">Last</th>
                        <th className="pb-2 text-right font-medium">Bid / Ask</th>
                        <th className="pb-2 text-right font-medium">Volume</th>
                        <th className="pb-2 text-right font-medium">OI</th>
                        <th className="pb-2 text-right font-medium">IV</th>
                        <th className="pb-2 text-right font-medium">Delta</th>
                        <th className="pb-2 text-right font-medium">Break-even</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chain.map((c) => (
                        <ChainRow key={c.ticker || `${c.type}-${c.strike}-${c.expiry}`} c={c} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No live options chain for {ticker} on the current data plan.
              </p>
            )}
          </div>

          {!!research.data?.notes.length && (
            <p className="text-[11px] text-muted-foreground">{research.data.notes.join(" ")}</p>
          )}
        </>
      )}
    </div>
  );
}
