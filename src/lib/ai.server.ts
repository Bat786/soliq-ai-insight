/** Server-only context builder + model call for SOLIQ AI. */

const MODEL = "google/gemini-3.6-flash";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

/** Compact snapshot of every desk so the assistant answers from live data. */
export async function buildDeskContext(): Promise<string> {
  const [{ loadTapeBoard }, whales, dex] = await Promise.all([
    import("@/lib/tape.server"),
    import("@/lib/unusual-whales.server").catch(() => null),
    import("@/lib/dex.server").catch(() => null),
  ]);

  const parts: string[] = [];

  try {
    const board = await loadTapeBoard();
    const byDesk = new Map<string, string[]>();
    for (const r of board.rows) {
      if (r.status !== "live") continue;
      const line = `${r.code} ${r.last} ${pct(r.changePct)} rsi${r.indicators.rsi14.toFixed(0)} ${r.indicators.verdict}(${r.indicators.score})`;
      const list = byDesk.get(r.desk) ?? [];
      list.push(line);
      byDesk.set(r.desk, list);
    }
    for (const [desk, lines] of byDesk) parts.push(`## ${desk.toUpperCase()} desk\n${lines.join("\n")}`);
  } catch {
    /* tape unavailable */
  }

  try {
    const feed = await whales?.loadWhaleFeed?.();
    if (feed) {
      const sig = (feed as { signal?: { label?: string; bull?: number; bear?: number } }).signal;
      if (sig) parts.push(`## Institutional flow\nwhale conviction: ${sig.label} (bull ${sig.bull} / bear ${sig.bear})`);
    }
  } catch {
    /* whales unavailable */
  }

  try {
    const desk = await dex?.loadCryptoDesk?.();
    const movers = (desk as { organic?: { symbol: string; changePct?: number; score?: number }[] } | undefined)?.organic;
    if (movers?.length) {
      parts.push(
        `## Solana / DEX organic leaders\n` +
          movers
            .slice(0, 12)
            .map((t) => `${t.symbol} ${pct(t.changePct ?? 0)} score ${t.score ?? "-"}`)
            .join("\n"),
      );
    }
  } catch {
    /* dex unavailable */
  }

  return parts.join("\n\n").slice(0, 12000);
}

const SYSTEM = `You are SOLIQ AI, the research assistant inside the SOLIQ market intelligence terminal.
You cover four desks: crypto (Solana/DEX + majors), stocks, futures (ES, NQ, CL, GC, SI, HG, BTC/ETH CME) and 24/7 forex.
Ground every claim in the LIVE MARKET CONTEXT provided. If a number is not in the context, say the tape does not show it instead of inventing it.
Style: dense institutional desk notes in markdown — short bold headers, bullet lines, explicit levels and indicator readings, then a one-line verdict with a 0-100 conviction score.
Always close with: *Research, not financial advice.*`;

import { ACCOUNT_SYSTEM_RULES } from "@/lib/account-context.server";

export async function askSoliqAi(messages: ChatTurn[], accountContext?: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this workspace.");
  const context = await buildDeskContext();

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "system", content: `LIVE MARKET CONTEXT (updated ${new Date().toUTCString()}):\n${context}` },
        { role: "system", content: ACCOUNT_SYSTEM_RULES },
        ...(accountContext
          ? [{ role: "system" as const, content: `MEMBER ACCOUNT CONTEXT (read-only):\n${accountContext}` }]
          : []),
        ...messages.slice(-12),
      ],
    }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("AI rate limit reached — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI request failed [${res.status}]`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() || "No answer came back from the model — try rephrasing.";
}
