import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, RadioTower, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

import { AppShell } from "@/components/soliq/AppShell";
import { WhaleStrip } from "@/components/soliq/WhaleSignal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAssistant } from "@/lib/ai.functions";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "AETHRON AI — Your Investing Research Assistant" },
      {
        name: "description",
        content:
          "Ask AETHRON AI to analyse coins, futures, forex and stocks using the live desk tape, indicators and institutional flow.",
      },
      { property: "og:title", content: "AETHRON AI — Investing Research Assistant" },
      { property: "og:description", content: "Live-tape answers across crypto, stocks, futures and forex desks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Assistant,
});

const prompts = [
  "Analyze Solana for the next 30 days",
  "Which futures contracts are most bullish right now?",
  "Read the forex tape — where is dollar strength strongest?",
  "Find Solana tokens with whale accumulation",
  "Compare NVDA momentum with the Nasdaq futures tape",
];

type Msg = { role: "user" | "assistant"; content: string };

const greeting: Msg = {
  role: "assistant",
  content:
    "**AETHRON AI online.**\n\nI read the live tape across four desks — crypto (Solana/DEX + majors), stocks, futures and 24/7 forex — plus institutional flow. Ask for an asset breakdown, a cross-desk comparison, or a full research note.\n\n*Research, not financial advice.*",
};

function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([greeting]);
  const [input, setInput] = useState("");
  const ask = useServerFn(askAssistant);

  const mutation = useMutation({
    mutationFn: (history: Msg[]) => ask({ data: { messages: history } }),
    onSuccess: (res) => setMessages((m) => [...m, { role: "assistant", content: res.answer }]),
    onError: (e: Error) =>
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${e.message}` }]),
  });

  const send = (text: string) => {
    const t = text.trim();
    if (!t || mutation.isPending) return;
    const next: Msg[] = [...messages.filter((m) => m !== greeting), { role: "user", content: t }];
    setMessages((m) => [...m, { role: "user", content: t }]);
    setInput("");
    mutation.mutate(next);
  };

  return (
    <AppShell>
      <div className="mb-4">
        <WhaleStrip />
      </div>
      <div className="mx-auto flex max-w-3xl flex-col">
        <header className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary glow-ring">
            <Bot className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold">AETHRON AI</h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RadioTower className="size-3 text-primary" /> Grounded in the live crypto, stocks, futures & forex tape
            </p>
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
                  : "panel max-w-[92%] px-4 py-3.5 text-sm leading-relaxed"
              }
            >
              {m.role === "user" ?
                m.content
              : <div className="prose prose-sm prose-invert max-w-none prose-headings:font-display prose-strong:text-foreground prose-p:my-2 prose-li:my-0.5">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              }
            </div>
          ))}
          {mutation.isPending && (
            <div className="panel flex max-w-[92%] items-center gap-2 px-4 py-3.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Reading the live tape…
            </div>
          )}
        </div>

        <div className="sticky bottom-24 mt-5 flex gap-2 lg:bottom-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask about any asset, indicator or market move…"
            className="h-11 bg-surface/80 backdrop-blur"
          />
          <Button
            variant="hero"
            size="icon"
            className="size-11"
            disabled={mutation.isPending}
            onClick={() => send(input)}
            aria-label="Send"
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
