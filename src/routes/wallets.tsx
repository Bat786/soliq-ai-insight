import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Wallet } from "lucide-react";

import { AppShell } from "@/components/soliq/AppShell";
import { WalletTerminal } from "@/components/soliq/WalletTerminal";

export const Route = createFileRoute("/wallets")({
  head: () => ({
    meta: [
      { title: "Wallet Terminal — Track Solana & EVM Wallets | AETHRON" },
      {
        name: "description",
        content:
          "Link Phantom, Solflare, Backpack or MetaMask read-only and track live Solana and Ethereum balances inside the AETHRON terminal.",
      },
      { property: "og:title", content: "Wallet Terminal — AETHRON" },
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
        Connect Solana and EVM wallets read-only to fold on-chain holdings into your AETHRON portfolio view.
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5 text-bull" /> No transaction signing, no seed phrases, no spend permissions —
        ever.
      </p>

      <div className="mt-5 max-w-3xl">
        <WalletTerminal />
      </div>
    </AppShell>
  );
}
