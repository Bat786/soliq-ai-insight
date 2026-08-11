import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bot,
  Activity,
  Compass,
  Crown,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Radar,
  Sparkles,
  Users,
  Waves,
  Wallet,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

import { AppearanceMenu } from "@/components/soliq/AppearanceMenu";
import { NotificationBell } from "@/components/soliq/NotificationBell";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/hooks/use-soliq-account";
import { supabase } from "@/integrations/supabase/client";
import { assets, fmtPct } from "@/lib/market-data";
import { isPaid, planByTier, type Tier } from "@/lib/membership";

const nav = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/scanner", label: "Scanner", icon: Radar },
  { to: "/lists", label: "Lists", icon: ListChecks },
  { to: "/portfolio", label: "Portfolio", icon: Wallet },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/whales", label: "Whale Flow", icon: Waves },
  { to: "/futures", label: "Futures", icon: Activity },
  { to: "/community", label: "Community", icon: Users },
  { to: "/backtest", label: "Backtest", icon: FlaskConical },
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

export function MemberBadge({ tier, className = "" }: { tier: Tier; className?: string }) {
  if (!isPaid(tier)) return null;
  const elite = tier === "elite";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${
        elite ? "bg-warn/15 text-warn" : "bg-primary/15 text-primary"
      } ${className}`}
    >
      {elite ? <Crown className="size-2.5" /> : <BadgeCheck className="size-2.5" />}
      {elite ? "ELITE" : "PRO"}
    </span>
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

function AccountMenu() {
  const { data: profile, tier, isSignedIn } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!isSignedIn) {
    return (
      <Button asChild size="sm" variant="hero">
        <Link to="/auth">Sign in</Link>
      </Button>
    );
  }

  const name = profile?.display_name ?? "Member";

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="subtle" size="sm" className="gap-2">
          <span className="grid size-5 place-items-center rounded-full bg-primary/20 text-[9px] font-semibold text-primary">
            {name.slice(0, 2).toUpperCase()}
          </span>
          <span className="hidden max-w-24 truncate sm:inline">{name}</span>
          <MemberBadge tier={tier} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {planByTier(tier).name} plan
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/pricing">
            <Sparkles className="size-4" /> {isPaid(tier) ? "Manage membership" : "Upgrade to Premium"}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/lists">
            <ListChecks className="size-4" /> My alerts
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarFooter() {
  const { tier, isSignedIn } = useProfile();

  if (isSignedIn && isPaid(tier)) {
    return (
      <div className="m-3 rounded-xl border border-primary/30 bg-primary/8 p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium">
          <MemberBadge tier={tier} /> membership active
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Unlimited alerts, community posting and your verified badge are unlocked.
        </p>
        <Button asChild variant="subtle" size="sm" className="mt-3 w-full">
          <Link to="/pricing">Manage plan</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="m-3 rounded-xl border border-border bg-surface-2/60 p-4">
      <p className="text-xs font-medium">{isSignedIn ? "Explorer plan" : "Guest preview mode"}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {isSignedIn
          ? "Upgrade for unlimited alerts, a member badge and posting rights."
          : "Create an account to sync watchlists, alerts and portfolios."}
      </p>
      <Button asChild variant="hero" size="sm" className="mt-3 w-full">
        <Link to={isSignedIn ? "/pricing" : "/auth"}>{isSignedIn ? "Go Premium" : "Explore SOLIQ Free"}</Link>
      </Button>
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
          <Link
            to="/pricing"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              pathname.startsWith("/pricing")
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            }`}
          >
            <Sparkles className="size-4.5" />
            Premium
          </Link>
        </nav>
        <SidebarFooter />
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
              <AppearanceMenu />
              <NotificationBell />
              <AccountMenu />
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
