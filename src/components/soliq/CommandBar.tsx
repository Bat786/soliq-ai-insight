import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseScanCommand } from "@/lib/live-market.functions";
import type { ScanFilters } from "@/lib/market-types";

const examples = [
  "Solana tokens under $25M market cap with rising whale accumulation",
  "Memecoins up over 50% today with low holder concentration",
  "Oversold DeFi tokens with AI confidence above 80",
  "Highest relative volume large caps breaking out",
];

export function CommandBar({
  onResult,
}: {
  onResult: (filters: Partial<ScanFilters>, name: string, summary: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const parse = useServerFn(parseScanCommand);

  const run = useMutation({
    mutationFn: (p: string) => parse({ data: { prompt: p } }),
    onSuccess: (r) => {
      onResult(r.filters, r.name, r.summary);
      toast.success(r.name, { description: r.summary || "Scanner configured by AI." });
    },
    onError: (e: Error) => toast.error("Command failed", { description: e.message }),
  });

  const submit = () => {
    const p = prompt.trim();
    if (p.length < 4) return;
    run.mutate(p);
  };

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-primary">
        <Sparkles className="size-3.5" /> AI Command Center
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Describe the scan you want in plain English…"
          className="h-10"
        />
        <Button variant="hero" onClick={submit} disabled={run.isPending} className="shrink-0">
          {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          Build scan
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setPrompt(ex);
              run.mutate(ex);
            }}
            className="rounded-full border border-border/70 bg-surface-2/50 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
