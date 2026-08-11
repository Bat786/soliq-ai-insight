import { useEffect, useState } from "react";

import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

const steps = [
  "Booting SOLIQ · AETHRON engine",
  "Syncing Solana on-chain liquidity",
  "Streaming crypto · stocks · futures tape",
  "Calibrating AI conviction models",
];

/** Branded splash shown while the app boots. */
export function Splash() {
  const [pct, setPct] = useState(8);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setPct((p) => Math.min(96, p + 6 + Math.random() * 10));
      setStep((s) => (s + 1) % steps.length);
    }, 320);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="hero-bg fixed inset-0 z-100 grid place-items-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <div className="relative mx-auto grid size-20 place-items-center">
          <span className="absolute inset-0 animate-[spin_5s_linear_infinite] rounded-full border border-primary/25 border-t-primary/80" />
          <span className="absolute inset-2 rounded-full bg-primary/10 blur-md" />
          <span className="relative grid size-14 place-items-center rounded-2xl bg-primary/15 glow-ring">
            <span className="font-display text-xl font-bold text-gradient">SQ</span>
          </span>
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">
          SOL<span className="text-gradient">IQ</span>
        </h1>
        <p className="mt-1 text-[10px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
          Powered by AETHRON
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Solana Blockchain Intelligence Engine</p>

        <Progress value={pct} className="mt-6 h-1.5" />
        <p className="num mt-2 text-[11px] text-muted-foreground">{steps[step]}…</p>


        <div className="mt-6 space-y-2">
          <Skeleton className="h-8 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-16 flex-1" />
            <Skeleton className="h-16 flex-1" />
            <Skeleton className="h-16 flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Wraps the app and shows the splash on first paint only. */
export function SplashGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem("soliq.splash");
    if (seen) {
      setReady(true);
      return;
    }
    const t = setTimeout(() => {
      sessionStorage.setItem("soliq.splash", "1");
      setReady(true);
    }, 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {children}
      {!ready && <Splash />}
    </>
  );
}
