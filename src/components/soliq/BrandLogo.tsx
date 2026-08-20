import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary glow-ring">
        <Zap className="size-4.5" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg font-bold tracking-tight">
            SOL<span className="text-gradient">IQ</span>
          </span>
          <span className="mt-0.5 text-[9px] font-medium tracking-[0.22em] text-muted-foreground">
            POWERED BY AETHRON
          </span>
        </span>
      )}
    </Link>
  );
}