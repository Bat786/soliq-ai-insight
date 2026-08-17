import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Wallet } from "lucide-react";

import { AppShell } from "@/components/soliq/AppShell";
import { SwapTerminal } from "@/components/soliq/SwapTerminal";
import { WalletTerminal } from "@/components/soliq/WalletTerminal";

export const Route = createFileRoute("/wallets")({
  head: () => ({
    meta: [
      { title: "Wallet Terminal — Track Solana & EVM Wallets | SOLIQ" },
      {
        name: "description",
        content:
          "Link Phantom, Solflare, Backpack or MetaMask read-only and track live Solana and Ethereum balances inside the SOLIQ terminal.",
      },
      { property: "og:title", content: "Wallet Terminal — SOLIQ" },
      {
        property: "og:description",
        content: "Read-only Solana and EVM wallet tracking with live balances and USD valuation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WalletsPage,
});

function WalletsPage() {
  return (
    <AppShell>
      <h1 className="flex items-center gap-2 text-xl font-bold lg:text-2xl">
        <Wallet className="size-5 text-primary" /> Wallet Terminal
      </h1>
      <p className="text-sm text-muted-foreground">
        Connect Solana and EVM wallets read-only to fold on-chain holdings into your SOLIQ portfolio view.
      </p>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-bull" />
        <span>
          SOLIQ has no custody of your funds and never receives your private keys or seed phrase. Tracking is read-only.
          If you start an action that needs a signature — such as a swap — you review and authorize that transaction in
          your own wallet.{" "}
          <Link to="/terms" hash="section-17" className="text-primary">
            Wallet terms
          </Link>{" "}
          ·{" "}
          <Link to="/privacy" hash="section-5" className="text-primary">
            wallet data
          </Link>
        </span>
      </p>


      <div className="mt-5 max-w-3xl">
        <WalletTerminal />
      </div>

      <div className="mt-5 max-w-3xl">
        <SwapTerminal />
      </div>
    </AppShell>
  );
}
