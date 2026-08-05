import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  Compass,
  LayoutDashboard,
  ListChecks,
  Radar,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { assets, fmtPct } from "@/lib/market-data";

const nav = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/scanner", label: "Scanner", icon: Radar },
  { to: "/lists", label: "Lists", icon: ListChecks },
  { to: "/portfolio", label: "Portfolio", icon: Wallet },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/community", label: "Community", icon: Users },
  { to: "/assistant", label: "AI Assistant", icon: Bot },
] as const;

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary glow-ring">
        <Zap className="size-4.5" />
      </span>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight">
          SOL<span className="text-gradient">IQ</span>
        </span>
      )}
    </Link>
  );
}

function Ticker() {
  const row = [...assets, ...assets];
  return (
    <div className="scroll-none overflow-hidden border-b border-border/70 bg-surface/40">
      <div className="flex w-max animate-[marquee_48s_linear_infinite] gap-6 px-4 py-1.5">
        {row.map((a, i) => (
          <span key={`${a.id}-${i}`} className="num flex items-center gap-2 text-[11px] whitespace-nowrap">
            <span className="text-muted-foreground">{a.symbol}</span>
            <span>{a.price < 1 ? a.price.toPrecision(3) : a.price.toLocaleString()}</span>
            <span className={a.change24h >= 0 ? "text-bull" : "text-bear"}>{fmtPct(a.change24h)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col border-r border-border bg-sidebar/80 backdrop-blur-xl">
        <div className="px-5 py-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`}
              >
                <Icon className="size-4.5" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 rounded-xl border border-border bg-surface-2/60 p-4">
          <p className="text-xs font-medium">Guest preview mode</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Demo data. Create an account to sync watchlists and portfolios.
          </p>
          <Button asChild variant="hero" size="sm" className="mt-3 w-full">
            <Link to="/auth">Explore SOLIQ Free</Link>
          </Button>
        </div>
      </div>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 glass">
          <Ticker />
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="lg:hidden">
              <Logo />
            </div>
            <p className="hidden text-xs text-muted-foreground lg:block">
              Markets open · Sentiment <span className="text-bull">Greed 72</span> · Latency 38ms
            </p>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link to="/assistant">Ask SOLIQ AI</Link>
              </Button>
              <Button asChild size="sm" variant="hero">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 pt-5 pb-28 lg:px-8 lg:pb-12">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 glass lg:hidden">
        <div className="scroll-none flex items-center justify-between gap-1 overflow-x-auto px-2 py-2">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
                {label === "AI Assistant" ? "AI" : label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
