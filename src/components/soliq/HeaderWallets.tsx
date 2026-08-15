import { ClientOnly } from "@tanstack/react-router";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Wallet2, Link2Off } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useEvmWallet, evmChainName } from "@/components/soliq/EvmWalletProvider";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

function EvmButton() {
  const { address, chainId, connected, connecting, connect, disconnect } = useEvmWallet();

  if (connected && address) {
    return (
      <Button
        size="sm"
        variant="subtle"
        onClick={disconnect}
        title={`${address} · ${evmChainName(chainId) ?? "EVM"} — click to disconnect`}
        className="num gap-1.5"
      >
        <span className="size-1.5 rounded-full bg-bull" />
        {short(address)}
        <span className="hidden text-[10px] text-muted-foreground sm:inline">
          {evmChainName(chainId) ?? "EVM"}
        </span>
        <Link2Off className="size-3.5 opacity-60" />
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" disabled={connecting} onClick={() => void connect("metamask")}>
      <Wallet2 className="size-4" />
      <span className="hidden sm:inline">{connecting ? "Connecting…" : "EVM"}</span>
    </Button>
  );
}

/**
 * Solana (wallet-adapter) and EVM connect controls, side by side. Both are
 * strictly client-rendered: the adapters touch window/crypto on init.
 */
export function HeaderWallets() {
  return (
    <ClientOnly fallback={<div className="h-8 w-24" aria-hidden />}>
      <div className="soliq-wallet-adapter flex items-center gap-2">
        <EvmButton />
        <WalletMultiButton />
      </div>
    </ClientOnly>
  );
}
