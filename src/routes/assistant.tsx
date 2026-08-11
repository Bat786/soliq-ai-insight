import { createFileRoute } from "@tanstack/react-router";
import { Bot, Send, Sparkles } from "lucide-react";
import { useState } from "react";

import { WhaleStrip } from "@/components/soliq/WhaleSignal";
import { AppShell } from "@/components/soliq/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "SOLIQ AI — Your Investing Research Assistant" },
      {
        name: "description",
        content:
          "Ask SOLIQ AI to analyse coins, explain market moves, compare assets, summarise news and build research reports.",
      },
      { property: "og:title", content: "SOLIQ AI — Investing Research Assistant" },
      { property: "og:description", content: "Analyse assets, explain indicators and generate research on demand." },
    ],
  }),
  component: Assistant,
});

const prompts = [
  "Analyze Solana for the next 30 days",
  "Find undervalued crypto projects",
  "Explain why Bitcoin moved today",
  "Compare ETH vs SOL",
  "Explain RSI divergence with an example",
];

type Msg = { role: "user" | "ai"; text: string };

const canned: Msg[] = [
  {
    role: "user",
    text: "Analyze Solana for the next 30 days",
  },
  {
    role: "ai",
    text: "**SOL · 30-day outlook (base case: constructive)**\n\n• Structure: higher highs and higher lows since the $186 reclaim; the $232 level is the invalidation for the current leg.\n• Flows: spot volume expanded 41% week-over-week while perp funding reset to neutral — buyers are paying in spot, not leverage.\n• On-chain: fee revenue and active addresses are both at 60-day highs; DEX volume share is holding above 30%.\n• Risk: a broad-market drawdown is the main threat — beta to BTC is ~1.4x. Memecoin cooldown could soften network activity.\n\n**SOLIQ Score: 94/100** — strong volume expansion, bullish momentum, improving sentiment.\n\n*This is research, not financial advice.*",
  },
];

function Assistant() {
  const [messages, setMessages] = useState<Msg[]>(canned);
  const [input, setInput] = useState("");

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", text: text.trim() },
      {
        role: "ai",
        text: "SOLIQ AI is in preview mode in this demo build. Connect Lovable Cloud + Lovable AI and I'll answer live with real market context, indicator breakdowns and full research reports.",
      },
    ]);
    setInput("");
  };

  return (
    <AppShell>
      <div className="mb-4"><WhaleStrip /></div>
      <div className="mx-auto flex max-w-3xl flex-col">
        <header className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary glow-ring">
            <Bot className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold">SOLIQ AI</h1>
            <p className="text-xs text-muted-foreground">Market intelligence · research · explanations</p>
          </div>
        </header>

        <div className="scroll-none mt-4 flex gap-2 overflow-x-auto pb-1">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-2/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="size-3.5 text-primary" /> {p}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary/15 px-4 py-3 text-sm"
                  : "panel max-w-[92%] px-4 py-3.5 text-sm leading-relaxed whitespace-pre-line"
              }
            >
              {m.text}
            </div>
          ))}
        </div>

        <div className="sticky bottom-24 mt-5 flex gap-2 lg:bottom-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask about any asset, indicator or market move…"
            className="h-11 bg-surface/80 backdrop-blur"
          />
          <Button variant="hero" size="icon" className="size-11" onClick={() => send(input)} aria-label="Send">
            <Send />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
