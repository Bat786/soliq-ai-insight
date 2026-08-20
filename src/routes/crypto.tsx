import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/soliq/AppShell";
import { CryptoDesk } from "@/components/soliq/CryptoDesk";
import { StablecoinDesk } from "@/components/soliq/StablecoinDesk";
import { SectionTitle } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";


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

const DESKS = [
  { id: "memecoins" as const, label: "Memecoins", subtitle: "DEX flow intelligence — Jupiter organic scoring and DexScreener pair data" },
  { id: "stablecoins" as const, label: "Stablecoins", subtitle: "Peg intelligence — Massive market data with Alchemy on-chain supply and balances" },
];

function CryptoPage() {
  const [desk, setDesk] = useState<"memecoins" | "stablecoins">("memecoins");
  const active = DESKS.find((d) => d.id === desk) ?? DESKS[0]!;

  return (
    <AppShell>
      <div className="space-y-5">
        <SectionTitle as="h1" title="Crypto Desk" subtitle={active.subtitle} />

        <div className="panel flex w-fit items-center gap-1 p-1">
          {DESKS.map((d) => (
            <Button
              key={d.id}
              size="sm"
              variant={desk === d.id ? "subtle" : "ghost"}
              onClick={() => setDesk(d.id)}
              className="h-7 px-3 text-[11px]"
            >
              {d.label}
            </Button>
          ))}
        </div>

        {desk === "memecoins" ? <CryptoDesk /> : <StablecoinDesk />}
      </div>
    </AppShell>
  );

}
