import { ClientOnly } from "@tanstack/react-router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Wallet2, Link2Off, ExternalLink, QrCode } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEvmWallet, evmChainName } from "@/components/soliq/EvmWalletProvider";
import {
  isMobileBrowser,
  metamaskDappLink,
  needsEvmDeepLink,
  needsSolanaDeepLink,
  openWalletApp,
  phantomBrowseLink,
  solflareBrowseLink,
} from "@/lib/wallet-mobile";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/**
 * Detection runs after hydration: injected providers announce themselves late,
 * and `navigator.userAgent` must not influence the SSR markup.
 */
function useMobileGaps() {
  const [state, setState] = useState({ mobile: false, solanaGap: false, evmGap: false });
  useEffect(() => {
    const scan = () =>
      setState({ mobile: isMobileBrowser(), solanaGap: needsSolanaDeepLink(), evmGap: needsEvmDeepLink() });
    scan();
    const timers = [250, 700, 1500].map((ms) => window.setTimeout(scan, ms));
    window.addEventListener("eip6963:announceProvider", scan as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("eip6963:announceProvider", scan as EventListener);
    };
  }, []);
  return state;
}

function EvmButton() {
  const { address, chainId, connected, connecting, connect, disconnect, metamaskDetected } = useEvmWallet();
  const { mobile, evmGap } = useMobileGaps();

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
        <span className="hidden text-[10px] text-muted-foreground sm:inline">{evmChainName(chainId) ?? "EVM"}</span>
        <Link2Off className="size-3.5 opacity-60" />
      </Button>
    );
  }

  // Mobile browser with no injected provider: a QR modal is useless on the same
  // device, so lead with the MetaMask app deep link and keep WalletConnect
  // (which does mobile app-to-app linking) as the second option.
  if (mobile && evmGap) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={connecting}>
            <Wallet2 className="size-4" />
            <span className="hidden sm:inline">{connecting ? "Connecting…" : "EVM"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
            Mobile browsers can&apos;t see wallet extensions — open your wallet app instead.
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openWalletApp(metamaskDappLink())}>
            <ExternalLink className="size-4" /> Open in MetaMask app
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void connect("walletconnect")}>
            <QrCode className="size-4" /> Other wallet (WalletConnect)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Desktop: extension detection is correct — MetaMask when present, otherwise
  // WalletConnect's QR to pair a phone.
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

/**
 * Solana connect control. On desktop (and inside a wallet's in-app browser) the
 * official adapter modal owns everything. In a plain mobile browser there is no
 * provider to detect, so we deep-link into the wallet app rather than letting
 * the adapter dead-end on its install page.
 */
function SolanaButton() {
  const { connected } = useWallet();
  const { mobile, solanaGap } = useMobileGaps();

  if (!connected && mobile && solanaGap) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Wallet2 className="size-4" />
            <span className="hidden sm:inline">Solana</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
            Continue in your wallet app — SOLIQ opens inside its browser and connects there.
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openWalletApp(phantomBrowseLink())}>
            <ExternalLink className="size-4" /> Open in Phantom
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openWalletApp(solflareBrowseLink())}>
            <ExternalLink className="size-4" /> Open in Solflare
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Android: Mobile Wallet Adapter is registered and appears in this modal. */}
          <div className="px-1 py-1">
            <WalletMultiButton />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return <WalletMultiButton />;
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
        <SolanaButton />
      </div>
    </ClientOnly>
  );
}
