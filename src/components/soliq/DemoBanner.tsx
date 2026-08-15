import { Link } from "@tanstack/react-router";
import { FlaskConical, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { disableDemo, useDemoMode } from "@/lib/demo";

/**
 * Persistent DEMO DATA banner. Market data in demo mode is the real live feed;
 * only account-linked surfaces (portfolio, wallets, brokerage) are simulated,
 * and those are labelled where they render.
 */
export function DemoBanner() {
  const demo = useDemoMode();
  if (!demo) return null;

  return (
    <div className="flex items-center gap-3 border-b border-warn/30 bg-warn/10 px-4 py-1.5 text-[11px]">
      <span className="inline-flex items-center gap-1.5 font-semibold tracking-wide text-warn">
        <FlaskConical className="size-3.5" /> DEMO DATA
      </span>
      <span className="hidden truncate text-muted-foreground sm:inline">
        Market feeds are live. Portfolio, wallet and brokerage figures are sample data until you connect an account.
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1">
        <Button asChild size="sm" variant="hero" className="h-6 px-2 text-[10px]">
          <Link to="/auth">Start free</Link>
        </Button>
        <button
          type="button"
          onClick={disableDemo}
          aria-label="Exit demo mode"
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </span>
    </div>
  );
}
