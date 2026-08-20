import "@/lib/node-globals";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { EmbeddedPreviewNotice } from "@/components/soliq/EmbeddedPreviewNotice";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";

import { SOLANA_RPC_PATH, getSolanaBalance, solanaNetwork } from "@/lib/solanaWallet";

export const Route = createFileRoute("/wallet-test")({
  head: () => ({
    meta: [
      { title: "Solana Wallet Test — Alchemy RPC | SOLIQ" },
      {
        name: "description",
        content:
          "Devnet test bench for SOLIQ's Solana wallet connection: connect Phantom or Solflare and read a live SOL balance through our Alchemy RPC endpoint.",
      },
      { property: "og:title", content: "Solana Wallet Test — SOLIQ" },
      {
        property: "og:description",
        content: "Connect Phantom or Solflare on devnet and verify balances resolve through the Alchemy RPC node.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WalletTestPage,
});

function Panel() {
  const { publicKey, connected, wallet } = useWallet();
  const { connection } = useConnection();
  const address = publicKey?.toBase58() ?? null;

  const balance = useQuery({
    queryKey: ["wallet-test-balance", address, solanaNetwork],
    queryFn: () => {
      if (!address) throw new Error("Connect a wallet first");
      return getSolanaBalance(address, connection);
    },
    enabled: !!address,
    refetchInterval: 15_000,
  });

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-14">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Solana wallet test</h1>
        <p className="text-sm text-muted-foreground">
          Connect Phantom or Solflare and read a live balance. RPC traffic is proxied to Alchemy — the API key stays on
          the server.
        </p>
      </header>

      <div className="soliq-wallet-adapter rounded-xl border border-border/60 bg-card/60 p-5 backdrop-blur">
        <WalletMultiButton />
        <EmbeddedPreviewNotice className="mt-3" />

        <dl className="num mt-5 space-y-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Network</dt>
            <dd>{solanaNetwork}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">RPC endpoint</dt>
            <dd className="truncate">{SOLANA_RPC_PATH} → Alchemy</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Wallet</dt>
            <dd>{wallet?.adapter.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Address</dt>
            <dd className="max-w-[60%] truncate">{address ?? "not connected"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Balance</dt>
            <dd>
              {!connected ? "—"
              : balance.isPending ? "loading…"
              : balance.isError ? "error"
              : `${balance.data?.toFixed(6)} SOL`}
            </dd>
          </div>
        </dl>

        {balance.isError && (
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-destructive">
            <Activity className="mt-0.5 size-3.5 shrink-0" />
            {balance.error instanceof Error ? balance.error.message : "Balance lookup failed"}
          </p>
        )}
      </div>
    </div>
  );
}

function WalletTestPage() {
  return (
    <ClientOnly fallback={<div className="min-h-screen" aria-hidden />}>
      <Panel />
    </ClientOnly>
  );
}
