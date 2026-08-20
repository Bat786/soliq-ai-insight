import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { SectionTitle } from "@/components/soliq/primitives";
import { fmtBig } from "@/components/soliq/WhaleSignal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWhaleFeed } from "@/hooks/use-whales";

type Side = "any" | "bullish" | "bearish";
type Rule = {
  id: string;
  ticker: string;
  minPremium: number;
  side: Side;
  source: "options" | "darkpool" | "both";
};

type Hit = {
  key: string;
  ruleId: string;
  ticker: string;
  source: "options" | "darkpool";
  premium: number;
  bullish: boolean;
  detail: string;
  at: number;
};

const STORE = "soliq.whale.alertRules";

function loadRules(): Rule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Rule[]) : [];
  } catch {
    return [];
  }
}

const defaultRules: Rule[] = [
  { id: "seed-1", ticker: "", minPremium: 2_500_000, side: "any", source: "both" },
];

/** User-defined whale alerts evaluated live against the Unusual Whales tape. */
export function WhaleAlerts() {
  const { data: feed } = useWhaleFeed();
  const data = feed?.available ? feed : undefined;
  const [rules, setRules] = useState<Rule[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [ticker, setTicker] = useState("");
  const [premium, setPremium] = useState("1000000");
  const [side, setSide] = useState<Side>("any");
  const [source, setSource] = useState<Rule["source"]>("both");
  const seen = useRef(new Set<string>());
  const primed = useRef(false);

  useEffect(() => {
    const stored = loadRules();
    setRules(stored.length > 0 ? stored : defaultRules);
  }, []);

  useEffect(() => {
    if (rules.length > 0 || loadRules().length > 0) {
      window.localStorage.setItem(STORE, JSON.stringify(rules));
    }
  }, [rules]);

  const matched = useMemo<Hit[]>(() => {
    if (!data) return [];
    const out: Hit[] = [];
    for (const rule of rules) {
      const want = rule.ticker.trim().toUpperCase();
      if (rule.source !== "darkpool") {
        for (const a of data.alerts) {
          if (want && a.ticker !== want) continue;
          if (a.premium < rule.minPremium) continue;
          const bullish = a.askSidePrem >= a.bidSidePrem;
          if (rule.side === "bullish" && !bullish) continue;
          if (rule.side === "bearish" && bullish) continue;
          out.push({
            key: `o-${a.id}-${rule.id}`,
            ruleId: rule.id,
            ticker: a.ticker,
            source: "options",
            premium: a.premium,
            bullish,
            detail: `${a.rule}${a.strike ? ` · strike ${a.strike}` : ""} · ${a.size.toLocaleString("en-US")} contracts`,
            at: a.createdAt,
          });
        }
      }
      if (rule.source !== "options") {
        for (const p of data.darkpool) {
          if (want && p.ticker !== want) continue;
          if (p.premium < rule.minPremium) continue;
          if (rule.side !== "any") continue;
          out.push({
            key: `d-${p.ticker}-${p.executedAt}-${p.size}-${rule.id}`,
            ruleId: rule.id,
            ticker: p.ticker,
            source: "darkpool",
            premium: p.premium,
            bullish: true,
            detail: `dark pool block · ${p.size.toLocaleString("en-US")} @ $${p.price.toFixed(2)}${p.extendedHours ? " · ext hours" : ""}`,
            at: p.executedAt,
          });
        }
      }
    }
    const dedup = new Map(out.map((h) => [h.key, h]));
    return [...dedup.values()].sort((a, b) => b.at - a.at).slice(0, 60);
  }, [data, rules]);

  useEffect(() => {
    if (matched.length === 0) return;
    const fresh = matched.filter((h) => !seen.current.has(h.key));
    for (const h of matched) seen.current.add(h.key);
    if (!primed.current) {
      primed.current = true;
      setHits(matched);
      return;
    }
    setHits(matched);
    for (const h of fresh.slice(0, 3)) {
      toast.info(`Whale alert · ${h.ticker}`, {
        description: `${fmtBig(h.premium)} ${h.source === "darkpool" ? "dark pool block" : h.bullish ? "ask-side sweep" : "bid-side sweep"}`,
      });
    }
  }, [matched]);

  const addRule = () => {
    const min = Number(premium.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(min) || min <= 0) {
      toast.error("Enter a premium threshold");
      return;
    }
    setRules((r) => [
      { id: `${Date.now()}`, ticker: ticker.trim().toUpperCase(), minPremium: min, side, source },
      ...r,
    ]);
    setTicker("");
    toast.success("Whale alert armed");
  };

  return (
    <div className="panel p-4">
      <SectionTitle
        title="Whale alerts"
        subtitle="Arm rules on premium size, side and venue — matches fire live off the tape"
      />

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
        <Input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Ticker (blank = any)"
          className="h-9 text-xs"
        />
        <Input
          value={premium}
          onChange={(e) => setPremium(e.target.value)}
          placeholder="Min premium"
          className="num h-9 text-xs"
        />
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as Side)}
          className="h-9 rounded-md border border-border bg-surface-2/60 px-2 text-xs"
        >
          <option value="any">Any side</option>
          <option value="bullish">Ask-side (bullish)</option>
          <option value="bearish">Bid-side (bearish)</option>
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as Rule["source"])}
          className="h-9 rounded-md border border-border bg-surface-2/60 px-2 text-xs"
        >
          <option value="both">Options + dark pool</option>
          <option value="options">Options only</option>
          <option value="darkpool">Dark pool only</option>
        </select>
        <Button size="sm" onClick={addRule} className="h-9">
          <Plus className="size-3.5" /> Arm
        </Button>
      </div>

      {rules.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rules.map((r) => (
            <span
              key={r.id}
              className="num inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px]"
            >
              {r.ticker || "ANY"} ≥ {fmtBig(r.minPremium)} · {r.side} · {r.source}
              <button
                type="button"
                onClick={() => setRules((rs) => rs.filter((x) => x.id !== r.id))}
                aria-label="Remove alert rule"
                className="text-muted-foreground hover:text-bear"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setRules([])}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-muted-foreground hover:text-bear"
          >
            <Trash2 className="size-3" /> clear all
          </button>
        </div>
      )}

      <div className="mt-3 max-h-80 overflow-y-auto">
        {hits.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No tape prints match your rules yet — lower the premium threshold to widen the net.
          </p>
        )}
        {hits.map((h) => (
          <div key={h.key} className="flex items-center gap-3 border-b border-border/60 py-2 last:border-0">
            <BellRing className={`size-3.5 shrink-0 ${h.bullish ? "text-bull" : "text-bear"}`} />
            <span className="num w-16 shrink-0 text-xs font-medium">{h.ticker}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px]">{h.detail}</p>
              <p className="num text-[10px] text-muted-foreground">
                {new Date(h.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                {" · "}
                {h.source === "darkpool" ? "dark pool" : "options"}
              </p>
            </div>
            <p className="num shrink-0 text-xs">{fmtBig(h.premium)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
