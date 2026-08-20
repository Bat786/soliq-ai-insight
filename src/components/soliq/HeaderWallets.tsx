import "@/lib/node-globals";

import { ClientOnly } from "@tanstack/react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Link2Off, Wallet2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useEvmWallet } from "@/components/soliq/EvmWalletProvider";
import { useSolanaAdapterLink } from "@/hooks/use-wallets";
import { cn } from "@/lib/utils";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/** Mount once per page: persists the connected adapter wallet to the portfolio. */
function SolanaPortfolioSync() {
  useSolanaAdapterLink();
  return null;
}

/**
 * Solana connect UI is the official <WalletMultiButton /> and nothing else:
 * it lists only wallets detected via the Wallet Standard, opens the real
 * extension popup, and switches to the connected address + copy/disconnect
 * dropdown. It is themed only through the documented
 * `.wallet-adapter-*` CSS overrides in src/styles.css.
 */
function Wallets({ className, sync }: { className?: string | undefined; sync: boolean }) {
  const { connected } = useWallet();
  const evm = useEvmWallet();

  return (
    <div className={cn("soliq-wallet-adapter flex min-w-0 shrink-0 items-center gap-2", className)}>
      {sync && connected && <SolanaPortfolioSync />}
      <WalletMultiButton />
      {evm.connected && evm.address ? (
        <Button size="sm" variant="subtle" className="num h-8 gap-1.5 px-2 text-xs" onClick={() => evm.disconnect()}>
          <Link2Off className="size-3.5" /> {short(evm.address)}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="subtle"
          className="h-8 gap-1.5 px-2 text-xs"
          disabled={evm.connecting}
          onClick={() => void evm.connect(evm.metamaskDetected ? "metamask" : "walletconnect")}
        >
          <Wallet2 className="size-3.5" />
          <span className="hidden sm:inline">{evm.connecting ? "Connecting…" : "EVM"}</span>
        </Button>
      )}
    </div>
  );
}

/**
 * Single entry point for wallet connections. Strictly client-rendered: the
 * adapters touch window/crypto on init.
 */
export function HeaderWallets({
  className,
  sync = true,
}: {
  className?: string | undefined;
  /** Only one mounted instance should own the portfolio-sync effect. */
  sync?: boolean;
}) {
  return (
    <ClientOnly fallback={<div className="h-8 w-8 shrink-0 sm:w-32" aria-hidden />}>
      <Wallets className={className} sync={sync} />
    </ClientOnly>
  );
}
