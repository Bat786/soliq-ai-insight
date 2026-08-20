/**
 * Per-symbol market provider diagnostics (server only).
 *
 * Probes every endpoint the ticker detail view depends on and reports whether it
 * succeeded, how long it took, how many rows came back, and — when it failed —
 * the provider's own reason (status code + message snippet).
 */

export type ProbeStatus = "ok" | "empty" | "failed" | "skipped";

export type ProbeResult = {
  provider: string;
  endpoint: string;
  label: string;
  status: ProbeStatus;
  httpStatus: number | null;
  ms: number;
  rows: number | null;
  detail: string;
};

export type ProviderReport = {
  symbol: string;
  checkedAt: number;
  probes: ProbeResult[];
  summary: { ok: number; empty: number; failed: number; skipped: number };
  verdict: string;
};

const UW_BASE = "https://api.unusualwhales.com";
const YF_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

const trim = (s: string, n = 180) => (s.length > n ? `${s.slice(0, n)}…` : s);

function countRows(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    const data = (value as Record<string, unknown>)["data"];
    if (Array.isArray(data)) return data.length;
    const results = (value as Record<string, unknown>)["results"];
    if (Array.isArray(results)) return results.length;
    return Object.keys(value as Record<string, unknown>).length;
  }
  return null;
}

async function probeJson(
  provider: string,
  label: string,
  endpoint: string,
  url: string,
  headers: Record<string, string>,
): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      return {
        provider,
        endpoint,
        label,
        status: "failed",
        httpStatus: res.status,
        ms,
        rows: null,
        detail: trim(text || res.statusText || `HTTP ${res.status}`),
      };
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        provider,
        endpoint,
        label,
        status: "failed",
        httpStatus: res.status,
        ms,
        rows: null,
        detail: "Response was not valid JSON",
      };
    }
    const rows = countRows(parsed);
    const empty = rows === 0 || rows === null;
    return {
      provider,
      endpoint,
      label,
      status: empty ? "empty" : "ok",
      httpStatus: res.status,
      ms,
      rows,
      detail: empty ? "Reachable but returned no rows for this symbol" : `${rows} field(s)/row(s) returned`,
    };
  } catch (err) {
    return {
      provider,
      endpoint,
      label,
      status: "failed",
      httpStatus: null,
      ms: Date.now() - started,
      rows: null,
      detail: trim((err as Error)?.message ?? "Network error"),
    };
  }
}

function skipped(provider: string, label: string, endpoint: string, detail: string): ProbeResult {
  return { provider, endpoint, label, status: "skipped", httpStatus: null, ms: 0, rows: null, detail };
}

export async function probeProviders(symbolRaw: string): Promise<ProviderReport> {
  const symbol = symbolRaw.trim().toUpperCase().replace(/[^A-Z.:-]/g, "");
  const probes: ProbeResult[] = [];

  /* ------------------------------ Unusual Whales ----------------------------- */
  const uwKey = process.env["UNUSUAL_WHALES_API_KEY"];
  const uwPaths: [string, string][] = [
    [`/api/stock/${symbol}/info`, "Reference info"],
    [`/api/stock/${symbol}/stock-state`, "Quote snapshot"],
    [`/api/stock/${symbol}/ohlc/1m?limit=180`, "1m bars"],
    [`/api/stock/${symbol}/ohlc/5m?limit=400`, "5m bars"],
    [`/api/stock/${symbol}/net-prem-ticks`, "Options premium ticks"],
  ];
  if (!uwKey) {
    for (const [path, label] of uwPaths) {
      probes.push(skipped("Unusual Whales", label, path, "No API key configured"));
    }
  } else {
    for (const [path, label] of uwPaths) {
      probes.push(
        await probeJson("Unusual Whales", label, path, `${UW_BASE}${path}`, {
          Authorization: `Bearer ${uwKey}`,
        }),
      );
    }
  }

  /* ---------------------------------- Massive -------------------------------- */
  const { massiveStatus, massiveBars, massiveDailyBars, massiveTickerOverview } = await import("./massive.server");
  const status = massiveStatus();
  if (!status.configured) {
    probes.push(skipped("Massive", "Intraday aggregates", "/v2/aggs", "No API key configured"));
    probes.push(skipped("Massive", "Daily aggregates", "/v2/aggs", "No API key configured"));
    probes.push(skipped("Massive", "Ticker reference", "/v3/reference/tickers", "No API key configured"));
  } else {
    const runners: [string, string, () => Promise<unknown>][] = [
      ["Intraday aggregates (5m)", "/v2/aggs/ticker/.../range/5/minute", () => massiveBars("stocks", symbol, "5m")],
      ["Daily aggregates", "/v2/aggs/ticker/.../range/1/day", () => massiveDailyBars("stocks", symbol, 120)],
      ["Ticker reference", "/v3/reference/tickers", () => massiveTickerOverview(symbol)],
    ];
    for (const [label, endpoint, run] of runners) {
      const started = Date.now();
      try {
        const value = await run();
        const rows = Array.isArray(value) ? value.length : value ? 1 : 0;
        probes.push({
          provider: "Massive",
          endpoint,
          label,
          status: rows > 0 ? "ok" : "empty",
          httpStatus: null,
          ms: Date.now() - started,
          rows,
          detail:
            rows > 0
              ? `${rows} row(s) returned`
              : status.cooldownMs > 0
                ? `Provider cooldown active for ${Math.ceil(status.cooldownMs / 1000)}s (rate limit)`
                : (status.lastError ?? "No data returned for this symbol on the current plan"),
        });
      } catch (err) {
        probes.push({
          provider: "Massive",
          endpoint,
          label,
          status: "failed",
          httpStatus: null,
          ms: Date.now() - started,
          rows: null,
          detail: trim((err as Error)?.message ?? "Request failed"),
        });
      }
    }
    for (const u of status.unentitled) {
      probes.push({
        provider: "Massive",
        endpoint: u.scope,
        label: "Plan entitlement",
        status: "failed",
        httpStatus: 403,
        ms: 0,
        rows: null,
        detail: trim(u.reason),
      });
    }
  }

  /* --------------------------- Keyless fallback tape -------------------------- */
  probes.push(
    await probeJson(
      "Fallback tape",
      "5m chart series",
      "/v8/finance/chart",
      `${YF_CHART}/${encodeURIComponent(symbol)}?interval=5m&range=5d&includePrePost=false`,
      {},
    ),
  );

  const summary = {
    ok: probes.filter((p) => p.status === "ok").length,
    empty: probes.filter((p) => p.status === "empty").length,
    failed: probes.filter((p) => p.status === "failed").length,
    skipped: probes.filter((p) => p.status === "skipped").length,
  };

  const priceOk = probes.some(
    (p) => p.status === "ok" && /bars|aggregates|chart series|Quote snapshot/i.test(p.label),
  );
  const verdict = !symbol
    ? "No symbol supplied"
    : priceOk
      ? "At least one price source is live — the detail view can render."
      : "No price source returned data. The detail view will report no market data.";

  return { symbol, checkedAt: Date.now(), probes, summary, verdict };
}
