import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  BarChart3,
  Bot,
  Activity,
  Coins,
  Compass,
  Crown,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PieChart,
  Radar,
  Settings,
  Sparkles,
  UserRound,
  Users,
  Waves,
  Building2,
  Wallet,
  Zap,
  LifeBuoy,
  Scale,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AppearanceMenu } from "@/components/soliq/AppearanceMenu";
import { DemoBanner } from "@/components/soliq/DemoBanner";
import { NotificationBell } from "@/components/soliq/NotificationBell";
import { HeaderWallets } from "@/components/soliq/HeaderWallets";

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
import { useTapeBoard } from "@/hooks/use-tape";
import { supabase } from "@/integrations/supabase/client";
import { fmtPct } from "@/lib/format";
import { isPaid, planByTier, type Tier } from "@/lib/membership";

const nav = [
  { to: "/terminal", label: "Home", icon: LayoutDashboard },
  { to: "/scanner", label: "Scanner", icon: Radar },
  { to: "/stocks", label: "Stocks", icon: BarChart3 },
  { to: "/futures", label: "Futures", icon: Activity },
  { to: "/crypto", label: "Crypto", icon: Coins },
  { to: "/whales", label: "Whale Flow", icon: Waves },
  { to: "/lists", label: "Lists", icon: ListChecks },
  { to: "/portfolio", label: "Portfolio", icon: PieChart },
  { to: "/wallets", label: "Wallets", icon: Wallet },
  { to: "/brokerage", label: "Brokerage", icon: Building2 },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/community", label: "Community", icon: Users },
  { to: "/backtest", label: "Backtest", icon: FlaskConical },
  { to: "/assistant", label: "AI Assistant", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/support", label: "Support", icon: LifeBuoy },
] as const;

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

/** Live multi-desk tape: crypto, stocks and futures streamed from our market APIs. */
function Ticker() {
  const board = useTapeBoard();

  const rows = (board.data?.rows ?? []).filter(
    (r) => (r.desk === "crypto" || r.desk === "stocks" || r.desk === "futures") && Number.isFinite(r.last) && r.last > 0,
  );

  const loading = !rows.length;
  const loop = loading ? [] : [...rows, ...rows];

  return (
    <div className="scroll-none overflow-hidden border-b border-border/70 bg-surface/40">
      {loading ? (
        <div className="px-4 py-1.5 text-[11px] text-muted-foreground">Streaming live crypto · stocks · futures tape…</div>
      ) : (
        <div className="flex w-max animate-[marquee_60s_linear_infinite] gap-6 px-4 py-1.5">
          {loop.map((r, i) => (
            <span key={`${r.key}-${i}`} className="num flex items-center gap-2 text-[11px] whitespace-nowrap">
              <span className="text-muted-foreground">{r.code}</span>
              <span>{r.last < 1 ? r.last.toPrecision(4) : r.last.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span className={r.changePct >= 0 ? "text-bull" : "text-bear"}>{fmtPct(r.changePct)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function useAvatarUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!path) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 6)
      .then(({ data }) => {
        if (live) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      live = false;
    };
  }, [path]);
  return url;
}

function AccountMenu() {
  const { data: profile, tier, isSignedIn } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const avatar = useAvatarUrl(profile?.avatar_url);

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
          {avatar ?
            <img src={avatar} alt={`${name} avatar`} className="size-5 rounded-full object-cover" />
          : <span className="grid size-5 place-items-center rounded-full bg-primary/20 text-[9px] font-semibold text-primary">
              {name.slice(0, 2).toUpperCase()}
            </span>
          }
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
          <Link to="/settings">
            <UserRound className="size-4" /> Profile & settings
          </Link>
        </DropdownMenuItem>
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
        <DropdownMenuItem asChild>
          <Link to="/status">
            <Activity className="size-4" /> Data & feed status
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/support">
            <LifeBuoy className="size-4" /> Support & billing help
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/terms">
            <Scale className="size-4" /> Terms of Service
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
      <p className="text-xs font-medium">{isSignedIn ? "Orbit plan" : "Guest preview mode"}</p>
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
            const active = pathname.startsWith(to);
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
          <DemoBanner />
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
              <HeaderWallets />
              <AppearanceMenu />
              <NotificationBell />
              <AccountMenu />
            </div>

          </div>
        </header>

        <main className="px-4 pt-5 pb-28 lg:px-8 lg:pb-12">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 glass lg:hidden">
        <div className="scroll-none flex items-stretch gap-1 overflow-x-auto px-2 py-2">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            const short =
              label === "AI Assistant" ? "AI" : label === "Whale Flow" ? "Whales" : label.split(" ")[0];
            return (
              <Link
                key={to}
                to={to}
                className={`flex w-16 shrink-0 flex-col items-center justify-start gap-1 rounded-lg px-1 py-1.5 text-center text-[10px] leading-tight whitespace-nowrap ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
                {short}
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
