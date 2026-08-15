import { ClientOnly } from "@tanstack/react-router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Wallet2, Link2Off } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useEvmWallet, evmChainName } from "@/components/soliq/EvmWalletProvider";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

function EvmButton() {
  const { address, chainId, connected, connecting, connect, disconnect, metamaskDetected } = useEvmWallet();

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

  // No injected extension (mobile browsers, Safari) → fall back to WalletConnect
  // instead of throwing "MetaMask not found".
  const connector = metamaskDetected ? "metamask" : "walletconnect";

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={connecting}
      onClick={() => void connect(connector)}
      title={metamaskDetected ? "Connect MetaMask" : "Connect an EVM wallet via WalletConnect"}
    >
      <Wallet2 className="size-4" />
      <span className="hidden sm:inline">{connecting ? "Connecting…" : "EVM"}</span>
    </Button>
  );
}

/** Live SOL balance for the connected adapter wallet, shown next to the button. */
function SolBalance() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [sol, setSol] = useState<number | null>(null);

  useEffect(() => {
    if (!connected || !publicKey) {
      setSol(null);
      return;
    }
    let alive = true;
    const read = () =>
      connection
        .getBalance(publicKey)
        .then((lamports) => {
          if (alive) setSol(lamports / 1_000_000_000);
        })
        .catch(() => undefined);
    void read();
    const id = window.setInterval(read, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [connected, publicKey, connection]);

  if (sol === null) return null;
  return (
    <span className="num hidden text-xs text-muted-foreground md:inline" title="Connected wallet SOL balance">
      {sol.toFixed(3)} SOL
    </span>
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
        <SolBalance />
        <EvmButton />
        <WalletMultiButton />
      </div>
    </ClientOnly>
  );
}

