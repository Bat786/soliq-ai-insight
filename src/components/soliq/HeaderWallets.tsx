import { ClientOnly } from "@tanstack/react-router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ChevronDown, ExternalLink, Link2Off, QrCode, Wallet2 } from "lucide-react";
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

/** Live SOL balance for the connected adapter wallet. */
function useSolBalance() {
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

  return sol;
}

/**
 * Picking a Solana wallet is two steps in wallet-adapter: `select()` stores the
 * choice, then `connect()` runs against the newly selected adapter. Because
 * `select` is async state, we connect from an effect once the adapter matches.
 */
function useSolanaPicker() {
  const { wallet, wallets, select, connect, connected, connecting } = useWallet();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;
    if (connected) {
      setPending(null);
      return;
    }
    if (wallet?.adapter.name !== pending || connecting) return;
    void connect()
      .catch(() => undefined)
      .finally(() => setPending(null));
  }, [pending, wallet, connected, connecting, connect]);

  const pick = (name: string) => {
    setPending(name);
    select(name as Parameters<typeof select>[0]);
  };

  const available = wallets.filter((w) => w.readyState === "Installed" || w.readyState === "Loadable");
  return { pick, available: available.length ? available : wallets, pending };
}

/**
 * One "Connect wallet" entry point for both chains. The dropdown groups Solana
 * (wallet-adapter) and EVM (injected / WalletConnect) options, and on a plain
 * mobile browser it swaps in wallet-app deep links, which are the only paths
 * that actually work there.
 */
function WalletMenu() {
  const solana = useWallet();
  const evm = useEvmWallet();
  const { mobile, solanaGap, evmGap } = useMobileGaps();
  const { pick, available, pending } = useSolanaPicker();
  const { setVisible: openWalletModal } = useWalletModal();
  const sol = useSolBalance();

  const solAddress = solana.publicKey?.toBase58() ?? null;
  const connectedCount = (solana.connected ? 1 : 0) + (evm.connected ? 1 : 0);
  const busy = solana.connecting || evm.connecting || Boolean(pending);

  const label =
    connectedCount === 0
      ? "Connect wallet"
      : connectedCount === 2
        ? "2 wallets"
        : evm.connected && evm.address
          ? short(evm.address)
          : solAddress
            ? short(solAddress)
            : "Wallet";

  return (
    <div className="soliq-wallet-adapter flex items-center gap-2">
      {sol !== null && (
        <span className="num hidden text-xs text-muted-foreground md:inline" title="Connected wallet SOL balance">
          {sol.toFixed(3)} SOL
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant={connectedCount ? "subtle" : "outline"} className="num gap-1.5" disabled={busy}>
            {connectedCount ? <span className="size-1.5 rounded-full bg-bull" /> : <Wallet2 className="size-4" />}
            <span className="max-w-[9rem] truncate">{busy ? "Connecting…" : label}</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {/* ------------------------------ Solana ------------------------------ */}
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Solana
          </DropdownMenuLabel>
          {solana.connected && solAddress ? (
            <>
              <DropdownMenuItem disabled className="num opacity-100">
                <span className="size-1.5 rounded-full bg-bull" /> {short(solAddress)}
                <span className="ml-auto text-[10px] text-muted-foreground">{solana.wallet?.adapter.name}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void solana.disconnect().catch(() => undefined)}>
                <Link2Off className="size-4" /> Disconnect Solana
              </DropdownMenuItem>
            </>
          ) : mobile && solanaGap ? (
            <>
              <DropdownMenuItem onClick={() => openWalletApp(phantomBrowseLink())}>
                <ExternalLink className="size-4" /> Open in Phantom app
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openWalletApp(solflareBrowseLink())}>
                <ExternalLink className="size-4" /> Open in Solflare app
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openWalletModal(true)}>
                <Wallet2 className="size-4" /> More Solana wallets
              </DropdownMenuItem>
            </>
          ) : (
            <>
              {available.slice(0, 4).map((w) => (
                <DropdownMenuItem key={w.adapter.name} onClick={() => pick(w.adapter.name)}>
                  {w.adapter.icon ? (
                    <img src={w.adapter.icon} alt="" className="size-4 rounded" />
                  ) : (
                    <Wallet2 className="size-4" />
                  )}
                  {w.adapter.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => openWalletModal(true)}>
                <Wallet2 className="size-4" /> More Solana wallets
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          {/* -------------------------------- EVM ------------------------------- */}
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Ethereum &amp; EVM
          </DropdownMenuLabel>
          {evm.connected && evm.address ? (
            <>
              <DropdownMenuItem disabled className="num opacity-100">
                <span className="size-1.5 rounded-full bg-bull" /> {short(evm.address)}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {evmChainName(evm.chainId) ?? "EVM"}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => evm.disconnect()}>
                <Link2Off className="size-4" /> Disconnect EVM
              </DropdownMenuItem>
            </>
          ) : mobile && evmGap ? (
            <>
              <DropdownMenuItem onClick={() => openWalletApp(metamaskDappLink())}>
                <ExternalLink className="size-4" /> Open in MetaMask app
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void evm.connect("walletconnect")}>
                <QrCode className="size-4" /> Other wallet (WalletConnect)
              </DropdownMenuItem>
            </>
          ) : (
            <>
              {evm.metamaskDetected && (
                <DropdownMenuItem onClick={() => void evm.connect("metamask")}>
                  <Wallet2 className="size-4" /> MetaMask
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => void evm.connect("walletconnect")}>
                <QrCode className="size-4" /> WalletConnect
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
            SOLIQ never holds your keys or seed phrase. Any action that needs a signature is reviewed and approved in
            your wallet.
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Single header entry point for wallet connections. Strictly client-rendered:
 * the adapters touch window/crypto on init.
 */
export function HeaderWallets() {
  return (
    <ClientOnly fallback={<div className="h-8 w-32" aria-hidden />}>
      <WalletMenu />
    </ClientOnly>
  );
}
