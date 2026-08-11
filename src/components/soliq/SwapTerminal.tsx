import { ClientOnly } from "@tanstack/react-router";
import { ArrowLeftRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const PLUGIN_SRC = "https://plugin.jup.ag/plugin-v1.js";

type JupiterPlugin = {
  init: (opts: { displayMode: "integrated"; integratedTargetId: string; formProps?: Record<string, unknown> }) => void;
};

function loadPlugin(): Promise<JupiterPlugin> {
  const existing = (window as unknown as { Jupiter?: JupiterPlugin }).Jupiter;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PLUGIN_SRC;
    script.async = true;
    script.onload = () => {
      const plugin = (window as unknown as { Jupiter?: JupiterPlugin }).Jupiter;
      if (plugin) resolve(plugin);
      else reject(new Error("plugin-missing"));
    };
    script.onerror = () => reject(new Error("plugin-failed"));
    document.head.appendChild(script);
  });
}

function JupiterSwap() {
  const mounted = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    let cancelled = false;
    loadPlugin()
      .then((plugin) => {
        if (cancelled) return;
        plugin.init({
          displayMode: "integrated",
          integratedTargetId: "soliq-jupiter-swap",
          formProps: { initialInputMint: "So11111111111111111111111111111111111111112" },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <div className="rounded-xl border border-border bg-surface-2/40 p-4 text-xs text-muted-foreground">
        Swap terminal is unavailable right now.{" "}
        <a className="text-primary underline" href="https://jup.ag" target="_blank" rel="noreferrer noopener">
          Open Jupiter
        </a>
      </div>
    );
  }

  return <div id="soliq-jupiter-swap" className="min-h-[520px] w-full overflow-hidden rounded-xl" />;
}

/** Solana swap desk powered by the Jupiter aggregator (signing happens in your wallet). */
export function SwapTerminal() {
  return (
    <div className="panel p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ArrowLeftRight className="size-4 text-primary" /> Swap desk · Jupiter aggregator
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Best-route Solana swaps. Every transaction is signed inside your own wallet — SOLIQ never holds funds.
      </p>
      <div className="mt-4">
        <ClientOnly fallback={<div className="min-h-[520px] animate-pulse rounded-xl bg-surface-2/40" />}>
          <JupiterSwap />
        </ClientOnly>
      </div>
    </div>
  );
}
