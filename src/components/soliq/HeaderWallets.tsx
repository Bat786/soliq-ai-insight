import "@/lib/node-globals";
import { ClientOnly } from "@tanstack/react-router";
import { WalletReadyState, type Adapter } from "@solana/wallet-adapter-base";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { CheckCircle2, ChevronDown, Download, ExternalLink, Link2Off, QrCode, ShieldCheck, Wallet2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEvmWallet, evmChainName } from "@/components/soliq/EvmWalletProvider";
import { useMobileWalletSession, useSolanaAdapterLink } from "@/hooks/use-wallets";
import { backpackBrowseLink, buildConnectLink } from "@/lib/wallet-deeplink";
import { cn } from "@/lib/utils";
import {
  isMobileBrowser,
  metamaskDappLink,
  needsEvmDeepLink,
  needsSolanaDeepLink,
  openWalletApp,
} from "@/lib/wallet-mobile";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/** Extensions we point users at when nothing is injected in this browser. */
const INSTALL_LINKS: { name: string; url: string }[] = [
  { name: "Phantom", url: "https://phantom.app/download" },
  { name: "Solflare", url: "https://solflare.com/download" },
  { name: "Backpack", url: "https://backpack.app/download" },
];

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
 *
 * Only adapters whose `readyState` is Installed/Loadable are offered — calling
 * `connect()` on a NotDetected adapter navigates the tab to the wallet's
 * download page, which is what regressed the connect flow.
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

  const adapters = useMemo(() => wallets.map((w) => w.adapter), [wallets]);
  /** Extensions actually injected in this browser — `connect()` opens their popup. */
  const installed = useMemo(
    () => adapters.filter((a: Adapter) => a.readyState === WalletReadyState.Installed),
    [adapters],
  );
  /**
   * Loadable adapters (Solflare web wallet, Phantom on iOS) navigate away on
   * `connect()`. They are listed separately and labelled so a click never looks
   * like a broken connect attempt.
   */
  const loadable = useMemo(
    () => adapters.filter((a: Adapter) => a.readyState === WalletReadyState.Loadable),
    [adapters],
  );

  return { pick, installed, loadable, pending };

}

function Row({
  onClick,
  icon,
  label,
  hint,
  tone = "default",
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  tone?: "default" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border/70 bg-surface-2/60 px-3 py-2.5 text-left transition-colors",
        "hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        tone === "muted" && "bg-transparent",
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background/80 text-primary [&_img]:size-5 [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="block truncate text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
  );
}

/**
 * One "Connect wallet" entry point for both chains, styled entirely with SOLIQ
 * primitives (Dialog + Button + design tokens) instead of the wallet-adapter
 * default modal. On a plain mobile browser it swaps in wallet-app deep links,
 * which are the only paths that work there.
 */
/** Mount once per page: persists the connected adapter wallet to the portfolio. */
function SolanaPortfolioSync() {
  useSolanaAdapterLink();
  useMobileWalletSession();
  return null;
}

function WalletMenu({ className, sync }: { className?: string | undefined; sync: boolean }) {
  const solana = useWallet();
  const evm = useEvmWallet();
  const { mobile, solanaGap, evmGap } = useMobileGaps();
  const { pick, installed, loadable, pending } = useSolanaPicker();
  const sol = useSolBalance();
  const mobileSession = useMobileWalletSession();
  const [open, setOpen] = useState(false);

  const solAddress = solana.publicKey?.toBase58() ?? mobileSession?.address ?? null;
  const solConnected = solana.connected || Boolean(mobileSession);
  const connectedCount = (solConnected ? 1 : 0) + (evm.connected ? 1 : 0);
  const busy = solana.connecting || evm.connecting || Boolean(pending);

  useEffect(() => {
    if (solConnected || evm.connected) setOpen(false);
  }, [solConnected, evm.connected]);

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

  const known = mobile ? [...installed, ...loadable] : installed;
  const missing = INSTALL_LINKS.filter(
    (l) => !known.some((a: Adapter) => a.name.toLowerCase() === l.name.toLowerCase()),
  );



  return (
    <div className={cn("flex min-w-0 shrink-0 items-center gap-2", className)}>
      {sync && <SolanaPortfolioSync />}
      {sol !== null && (
        <span className="num hidden text-xs text-muted-foreground md:inline" title="Connected wallet SOL balance">
          {sol.toFixed(3)} SOL
        </span>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant={connectedCount ? "subtle" : "hero"}
            disabled={busy}
            aria-label="Connect wallet"
            className="num h-8 shrink-0 gap-1.5 px-2 text-xs sm:px-3"
          >
            {connectedCount ? (
              <span className="size-1.5 rounded-full bg-bull" />
            ) : (
              <Wallet2 className="size-4 shrink-0" />
            )}
            <span className="hidden max-w-[8rem] truncate sm:inline">{busy ? "Connecting…" : label}</span>
            {connectedCount > 0 && (
              <span className="max-w-[4.5rem] truncate sm:hidden">{busy ? "…" : label}</span>
            )}
            <ChevronDown className="hidden size-3.5 opacity-60 sm:inline" />
          </Button>
        </DialogTrigger>


        <DialogContent className="max-w-md border-border bg-surface p-0">
          <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Wallet2 className="size-4 text-primary" /> Connect a wallet
            </DialogTitle>
            <DialogDescription className="text-xs">
              Approve the request in your wallet. SOLIQ reads public balances only.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
            {/* ------------------------------ Solana ------------------------------ */}
            <div>
              <SectionLabel>Solana</SectionLabel>
              {solConnected && solAddress ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-bull/30 bg-bull/10 px-3 py-2.5">
                    <CheckCircle2 className="size-4 text-bull" />
                    <span className="num text-sm">{short(solAddress)}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {solana.wallet?.adapter.name ?? mobileSession?.providerName}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground"
                    onClick={() => void solana.disconnect().catch(() => undefined)}
                  >
                    <Link2Off className="size-4" /> Disconnect Solana
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {!mobile && installed.length > 0 && (
                    <WalletMultiButton className="!h-10 !w-full !justify-center !rounded-md !bg-primary !font-sans !text-sm !text-primary-foreground hover:!bg-primary/90" />
                  )}

                  {/* Loadable adapters (Solflare web wallet, Phantom on iOS)
                      navigate the tab to the wallet's own site on connect().
                      On desktop that reads as "SOLIQ redirected me instead of
                      opening my extension", so they are only offered on mobile
                      where it is the only working path. */}
                  {mobile &&
                    loadable.map((a: Adapter) => (
                      <Row
                        key={a.name}
                        tone="muted"
                        onClick={() => pick(a.name)}
                        icon={a.icon ? <img src={a.icon} alt="" /> : <ExternalLink />}
                        label={a.name}
                        hint={pending === a.name ? "Opening wallet…" : "Continues in the wallet app"}
                      />
                    ))}


                  {mobile && solanaGap && (
                    <>
                      <Row
                        onClick={() => openWalletApp(buildConnectLink("phantom"))}
                        icon={<ExternalLink />}
                        label="Open in Phantom app"
                        hint="Approve in the app · returns here"
                      />
                      <Row
                        onClick={() => openWalletApp(buildConnectLink("solflare"))}
                        icon={<ExternalLink />}
                        label="Open in Solflare app"
                        hint="Approve in the app · returns here"
                      />
                      <Row
                        onClick={() => openWalletApp(backpackBrowseLink())}
                        icon={<ExternalLink />}
                        label="Open in Backpack app"
                        hint="Continue in Backpack's browser"
                      />
                    </>
                  )}

                  {!installed.length && !(mobile && solanaGap) && (

                    <p className="rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
                      No Solana wallet extension detected. Install one below, unlock it, then reload. Extensions do not
                      inject into embedded preview frames — open SOLIQ in its own tab.
                    </p>
                  )}

                  {missing.length > 0 && !mobile && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {missing.map((l) => (
                        <a
                          key={l.name}
                          href={l.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          <Download className="size-3" /> Install {l.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* -------------------------------- EVM ------------------------------- */}
            <div>
              <SectionLabel>Ethereum &amp; EVM</SectionLabel>
              {evm.connected && evm.address ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-bull/30 bg-bull/10 px-3 py-2.5">
                    <CheckCircle2 className="size-4 text-bull" />
                    <span className="num text-sm">{short(evm.address)}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {evmChainName(evm.chainId) ?? "EVM"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground"
                    onClick={() => evm.disconnect()}
                  >
                    <Link2Off className="size-4" /> Disconnect EVM
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {evm.metamaskDetected && (
                    <Row
                      onClick={() => void evm.connect("metamask")}
                      icon={<Wallet2 />}
                      label="MetaMask"
                      hint="Detected in this browser"
                    />
                  )}
                  {mobile && evmGap && (
                    <Row
                      onClick={() => openWalletApp(metamaskDappLink())}
                      icon={<ExternalLink />}
                      label="Open in MetaMask app"
                      hint="Continue in the wallet's browser"
                    />
                  )}
                  <Row
                    onClick={() => void evm.connect("walletconnect")}
                    icon={<QrCode />}
                    label="WalletConnect"
                    hint="Any EVM wallet · scan a QR from mobile"
                  />
                </div>
              )}
            </div>

            <p className="flex items-start gap-1.5 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-bull" />
              <span>
                SOLIQ never holds your keys or seed phrase. Any action that needs a signature is reviewed and approved
                in your wallet.
              </span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
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
      <WalletMenu className={className} sync={sync} />
    </ClientOnly>
  );
}
