import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/soliq/AppShell";
import { CryptoDesk } from "@/components/soliq/CryptoDesk";
import { SectionTitle } from "@/components/soliq/primitives";

export const Route = createFileRoute("/crypto")({
  head: () => ({
    meta: [
      { title: "Crypto Desk — live Solana DEX flow & token signals | SOLIQ" },
      {
        name: "description",
        content:
          "Live Solana and multi-chain DEX intelligence: Jupiter organic-flow scoring, buy/sell pressure gauges, trending metas, fresh launches and DexScreener pair search.",
      },
      { property: "og:title", content: "SOLIQ Crypto Desk" },
      {
        property: "og:description",
        content: "Jupiter + DexScreener powered on-chain flow, liquidity and bullish-bearish signals for every token.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://soliqintel.com/crypto" },
      { property: "og:image", content: "https://soliqintel.com/og-soliq.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://soliqintel.com/og-soliq.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://soliqintel.com/crypto" }],
  }),
  component: CryptoPage,
});

function CryptoPage() {
  return (
    <AppShell>
      <div className="space-y-5">
        <SectionTitle
          as="h1"
          title="Crypto Desk"
          subtitle="On-chain flow intelligence — Jupiter organic scoring and DexScreener pair data across Solana and beyond"
        />

        <CryptoDesk />
      </div>
    </AppShell>
  );
}
