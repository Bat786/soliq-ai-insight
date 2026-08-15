import { createServerFn } from "@tanstack/react-start";

import { emptyFilters, type LiveAsset, type ScanFilters } from "@/lib/market-types";

export const getMarketSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const { loadUniverse, loadGlobal } = await import("@/lib/live-market.server");
  const [universe, global] = await Promise.all([
    loadUniverse(),
    loadGlobal().catch(() => null),
  ]);
  const rows = universe.slice(0, 220).map((a) => ({
    ...a,
    series: a.series.filter((_, i) => i % 3 === 0),
  }));
  return { rows, global, updatedAt: Date.now() };
});

export const getAssetDetail = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; days?: number }) => ({
    id: String(input.id).slice(0, 80),
    days: Math.min(1825, Math.max(1, input.days ?? 90)),
  }))
  .handler(async ({ data }) => {
    const { loadUniverse, loadHistory, forecast } = await import("@/lib/live-market.server");
    const universe = await loadUniverse();
    const asset = universe.find((a) => a.id === data.id || a.symbol.toLowerCase() === data.id.toLowerCase());
    if (!asset) throw new Error("Asset not found in the SOLIQ universe");
    const history = await loadHistory(asset.id, data.days, {
      price: asset.price,
      volume: asset.volume24h,
      volatility: asset.indicators.volatility,
    });
    return {
      asset,
      history,
      forecast: forecast(asset, history.prices),
      peers: universe.filter((a) => a.sector === asset.sector && a.id !== asset.id).slice(0, 6),
    };
  });

/** AI Command Center: natural language -> scanner filters. */
export const parseScanCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string }) => ({ prompt: String(input.prompt).slice(0, 500) }))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");

    const schema = Object.keys(emptyFilters).join(", ");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              `You translate a trader's request into JSON scanner filters for a crypto market scanner. ` +
              `Allowed keys: ${schema}. Numeric keys use plain numbers (USD for caps/volume/liquidity, percent for changes, 0-100 for scores). ` +
              `sectors ⊂ [layer1,layer2,defi,memecoin,ai,gaming,rwa,stablecoin,other]. caps ⊂ [nano,micro,small,mid,large]. ` +
              `requireSignals ⊂ [breakout,breakdown,gapUp,gapDown,highOfDay,lowOfDay,nearHigh52,nearLow52,goldenCross,deathCross,oversold,overbought]. ` +
              `sort ∈ [aiScore,marketCap,volume24h,relVolume,change24h,change7d,rsi,riskScore,social]. ` +
              `Reply with JSON only: {"filters": {...only the keys you set...}, "name": "short list name", "summary": "one sentence"}.`,
          },
          { role: "user", content: data.prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI request failed [${res.status}]: ${body}`);
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { filters?: Partial<ScanFilters>; name?: string; summary?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI returned an unreadable response — rephrase your command.");
    }
    return {
      filters: parsed.filters ?? {},
      name: parsed.name ?? "AI scan",
      summary: parsed.summary ?? "",
    };
  });

export type MarketSnapshot = { rows: LiveAsset[]; global: { marketCap: number; volume: number; btcDominance: number; change24h: number } | null; updatedAt: number };
