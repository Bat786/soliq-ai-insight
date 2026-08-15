import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  Coins,
  FlaskConical,
  LineChart,
  PieChart,
  Radar,
  ShieldCheck,
  Sparkles,
  Users,
  Waves,
  Zap,
} from "lucide-react";

import { Logo } from "@/components/soliq/AppShell";
import { Sparkline } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-soliq-account";
import { useTapeBoard } from "@/hooks/use-tape";
import { enableDemo } from "@/lib/demo";
import { plans } from "@/lib/membership";

const SITE = "https://soliq-ai-insight.lovable.app";
const OG_IMAGE = `${SITE}/og-soliq.jpg`;

const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com/soliq.ai" },
  { label: "TikTok", href: "https://tiktok.com/@soliq.ai" },
  { label: "YouTube", href: "https://youtube.com/@soliq-ai" },
  { label: "X", href: "https://x.com/soliq_ai" },
];

const LANDING_TITLE = "SOLIQ — AI Market Intelligence & Crypto Trading Platform";
const LANDING_DESC =
  "Free AI market intelligence platform: live stock, crypto, futures and FX scanners, Solana whale flow, options flow, real-time alerts, backtesting and AI research in one terminal.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: LANDING_TITLE },
      { name: "description", content: LANDING_DESC },
      {
        name: "keywords",
        content:
          "AI market intelligence, crypto scanner, stock scanner, Solana whale tracker, options flow, futures signals, real-time stock alerts, backtesting platform, AI trading assistant, DEX analytics, portfolio tracker",
      },
      { property: "og:title", content: LANDING_TITLE },
      { property: "og:description", content: LANDING_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/` },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:site_name", content: "SOLIQ" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: LANDING_TITLE },
      { name: "twitter:description", content: LANDING_DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${SITE}/#org`,
              name: "SOLIQ",
              url: SITE,
              logo: `${SITE}/icon-512.png`,
              sameAs: SOCIALS.map((s) => s.href),
            },
            {
              "@type": "WebSite",
              "@id": `${SITE}/#website`,
              url: SITE,
              name: "SOLIQ",
              publisher: { "@id": `${SITE}/#org` },
            },
            {
              "@type": "SoftwareApplication",
              name: "SOLIQ",
              applicationCategory: "FinanceApplication",
              operatingSystem: "Web, iOS, Android",
              url: SITE,
              description: LANDING_DESC,
              offers: [
                { "@type": "Offer", name: "Orbit", price: "0", priceCurrency: "USD" },
                { "@type": "Offer", name: "Pro", price: "20", priceCurrency: "USD" },
                { "@type": "Offer", name: "Elite", price: "30", priceCurrency: "USD" },
              ],
            },
          ],
        }),
      },
    ],
  }),
  component: Landing,
});


const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
const price = (n: number) => (n < 1 ? n.toPrecision(4) : n.toLocaleString(undefined, { maximumFractionDigits: 2 }));

const sections = [
  {
    icon: Radar,
    title: "The Market Scanner",
    body: "Premarket, regular session and after-hours scans across equities, futures, FX and crypto — one merged dashboard with AETHRON conviction scoring.",
  },
  {
    icon: Bot,
    title: "AETHRON AI Engine",
    body: "Ask the engine anything about a symbol, a desk or your own portfolio. Answers are grounded in the live tape, not a generic chatbot.",
  },
  {
    icon: LineChart,
    title: "The Trader's Command Center",
    body: "1m to 1d candles, VWAP, RSI and EMA overlays, multi-timeframe signals and a per-symbol intelligence dashboard for every asset.",
  },
  {
    icon: Coins,
    title: "Crypto Intelligence",
    body: "Solana DEX flow from Jupiter and DexScreener, trending and new pools, organic score and buy-pressure reads on every token.",
  },
  {
    icon: BarChart3,
    title: "Options + Flow",
    body: "Options chains, unusual activity and institutional flow pulled from live provider feeds — surfaced next to the price action.",
  },
  {
    icon: Waves,
    title: "Dark Pool & Short Interest",
    body: "Off-exchange prints, sector heat and short interest so you can see the positioning behind the move.",
  },
  {
    icon: Zap,
    title: "Wallet Intelligence",
    body: "Connect Phantom, Solflare, Backpack or MetaMask read-only. Holdings, transaction ledger, fee analytics and P&L — no keys, no signing.",
  },
  {
    icon: Building2,
    title: "Brokerage Connectivity",
    body: "Link supported brokerages through SnapTrade for accounts, positions and trade history beside your on-chain book.",
  },
  {
    icon: PieChart,
    title: "Portfolio Analytics",
    body: "Asset, sector and chain allocation, concentration risk, drawdown, best and worst performers across every connected account.",
  },
  {
    icon: Users,
    title: "Community Terminal",
    body: "A members-only feed where ideas carry the ticker, the timeframe and the thesis instead of screenshots.",
  },
];

const capabilities = [
  "LIVE MARKET DATA",
  "AI INTELLIGENCE",
  "ADVANCED SCANNERS",
  "OPTIONS FLOW",
  "DARK POOL",
  "CRYPTO",
  "WALLETS",
  "BROKERAGE",
  "PORTFOLIO",
  "COMMUNITY",
];

function LiveStrip() {
  const board = useTapeBoard();
  const rows = (board.data?.rows ?? []).filter((r) => Number.isFinite(r.last) && r.last > 0).slice(0, 8);

  if (!rows.length) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rows.map((r) => (
        <div key={r.key} className="rounded-xl border border-border bg-surface-2/50 p-3">
          <p className="truncate text-[11px] text-muted-foreground">{r.code}</p>
          <p className="num text-sm font-medium">{price(r.last)}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="w-12">
              <Sparkline data={r.spark.length ? r.spark : [0, 0]} up={r.changePct >= 0} />
            </span>
            <span className={`num text-[11px] ${r.changePct >= 0 ? "text-bull" : "text-bear"}`}>
              {pct(r.changePct)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  const { isSignedIn } = useProfile();
  const board = useTapeBoard();
  const live = (board.data?.rows ?? []).filter((r) => Number.isFinite(r.last) && r.last > 0).length;

  const startDemo = () => {
    enableDemo();
    void navigate({ to: "/terminal" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="glass sticky top-0 z-30 border-b border-border/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={startDemo}>
              Explore demo
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button asChild variant="hero" size="sm">
              <Link to={isSignedIn ? "/terminal" : "/auth"}>{isSignedIn ? "Open terminal" : "Sign in"}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero-bg relative overflow-hidden px-4 py-14 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] tracking-[0.24em] text-primary uppercase">SOLIQ · powered by AETHRON</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight lg:text-6xl">
              The <span className="text-gradient">financial intelligence</span> platform.
            </h1>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground lg:text-base">
              Markets. Intelligence. Portfolio. Trading. One powerful financial command center.
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              <Button asChild variant="hero" size="lg">
                <Link to="/terminal">
                  Explore SOLIQ <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="subtle" size="lg">
                <Link to="/auth">Start free</Link>
              </Button>
              <Button variant="ghost" size="lg" onClick={startDemo}>
                <FlaskConical className="size-4" /> Watch demo
              </Button>
            </div>

            <div className="panel mt-10 p-4 lg:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-medium">
                  Live command center preview
                  <span className="ml-2 text-[11px] text-muted-foreground">real market data, streaming now</span>
                </p>
                <span className="inline-flex items-center gap-1.5 text-[10px] tracking-wide text-bull uppercase">
                  <span className="size-1.5 rounded-full bg-bull" /> Live
                </span>
              </div>
              <LiveStrip />
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-surface/30 px-4 py-12">
          <div className="mx-auto max-w-6xl">
            <h2 className="max-w-2xl text-2xl font-bold lg:text-3xl">
              Stop jumping between 10 different financial apps.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Everything you need to understand the market — in one command center.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {capabilities.map((c) => (
                <span
                  key={c}
                  className="rounded-lg border border-border bg-surface-2/60 px-3 py-1.5 text-[11px] tracking-wide text-muted-foreground"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-14">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold lg:text-3xl">Inside the platform</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every desk runs on live provider data — nothing here is a mock-up of a product that doesn't exist.
            </p>
            <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sections.map(({ icon: Icon, title, body }) => (
                <div key={title} className="panel p-5">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="size-4.5" />
                  </span>
                  <h3 className="mt-3 font-display text-base font-semibold">{title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-surface/30 px-4 py-12">
          <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-3">
            <div className="panel p-5">
              <p className="num text-2xl font-bold text-gradient">{live || "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Instruments streaming live right now</p>
            </div>
            <div className="panel p-5">
              <p className="num text-2xl font-bold text-gradient">6</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Asset classes: equities, ETFs, options, futures, FX &amp; crypto
              </p>
            </div>
            <div className="panel p-5">
              <p className="num text-2xl font-bold text-gradient">8</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Data providers wired in: Massive, Jupiter, DexScreener, CoinGecko, GeckoTerminal, Alchemy, SnapTrade,
                Unusual Whales
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-14">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold lg:text-3xl">Start free. Upgrade when the edge is obvious.</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  No feature teasers behind a paywalled shell — explore the whole terminal, then unlock depth.
                </p>
              </div>
              <Button asChild variant="subtle">
                <Link to="/pricing">See full pricing</Link>
              </Button>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {plans.map((p) => (
                <div
                  key={p.tier}
                  className={`panel p-5 ${p.tier === "pro" ? "border-primary/40 ring-1 ring-primary/20" : ""}`}
                >
                  <p className="font-display text-base font-semibold">{p.name}</p>
                  <p className="num mt-1 text-2xl font-bold">
                    {p.price === 0 ? "Free" : `$${p.price}`}
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">{p.cadence}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>
                  <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Sparkles className="mt-0.5 size-3 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/70 px-4 py-14">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/60 px-3 py-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-bull" /> Read-only connections · no seed phrases · no custody of
              funds
            </span>
            <h2 className="mt-5 text-2xl font-bold lg:text-3xl">Make SOLIQ your financial command center.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect a wallet, a brokerage or nothing at all — the markets desk works before you link anything.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild variant="hero" size="lg">
                <Link to="/auth">Create your account</Link>
              </Button>
              <Button variant="subtle" size="lg" onClick={startDemo}>
                <Activity className="size-4" /> Explore demo first
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-[11px] text-muted-foreground">
          <nav aria-label="SOLIQ on social media" className="flex flex-wrap items-center gap-4">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="me noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>SOLIQ · powered by AETHRON — Solana Blockchain Intelligence Engine</p>
            <p>Market data is informational only and is not investment advice.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
