import "@/lib/node-globals";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { isAndroid } from "@/lib/wallet-mobile";

import "@solana/wallet-adapter-react-ui/styles.css";

export type Cluster = "mainnet-beta" | "devnet";

const CLUSTER_KEY = "soliq.cluster";

type ClusterCtx = { cluster: Cluster; setCluster: (c: Cluster) => void; endpoint: string };
const ClusterContext = createContext<ClusterCtx>({
  cluster: "mainnet-beta",
  setCluster: () => undefined,
  endpoint: clusterApiUrl("mainnet-beta"),
});

/** Which Solana cluster the terminal is reading from. */
export const useCluster = () => useContext(ClusterContext);

/**
 * Real Solana wallet-adapter context. Backpack, Glow and every other
 * Wallet-Standard wallet is auto-detected by the adapter, so only the two
 * legacy injected adapters need to be listed explicitly. The chosen wallet is
 * persisted under a SOLIQ-specific key so sessions survive reloads.
 */
export function WalletContextProvider({ children }: { children: ReactNode }) {
  const [cluster, setClusterState] = useState<Cluster>("mainnet-beta");

  // localStorage is browser-only — hydrate after mount to avoid SSR mismatch.
  useEffect(() => {
    const stored = window.localStorage.getItem(CLUSTER_KEY);
    if (stored === "devnet" || stored === "mainnet-beta") setClusterState(stored);
  }, []);

  const setCluster = useCallback((next: Cluster) => {
    setClusterState(next);
    window.localStorage.setItem(CLUSTER_KEY, next);
  }, []);

  // Swap the RPC by setting VITE_SOLANA_RPC_URL (e.g. a Helius/Alchemy mainnet
  // endpoint); otherwise fall back to the public cluster URL.
  const endpoint = useMemo(() => {
    const custom = import.meta.env["VITE_SOLANA_RPC_URL"] as string | undefined;
    return cluster === "mainnet-beta" && custom ? custom : clusterApiUrl(cluster);
  }, [cluster]);
  // On Android, Solana Mobile's Mobile Wallet Adapter is the official standard
  // for connecting native wallet apps from a regular mobile browser (there is
  // no injected provider there). It is registered lazily and browser-only.
  const [mobileAdapter, setMobileAdapter] = useState<unknown | null>(null);
  useEffect(() => {
    if (!isAndroid()) return;
    let cancelled = false;
    void import("@solana-mobile/wallet-adapter-mobile")
      .then(({ SolanaMobileWalletAdapter, createDefaultAuthorizationResultCache, createDefaultWalletNotFoundHandler }) => {
        if (cancelled) return;
        setMobileAdapter(
          new SolanaMobileWalletAdapter({
            addressSelector: {
              select: (addresses: string[]) => Promise.resolve(addresses[0]!),
            },
            appIdentity: { name: "SOLIQ", uri: window.location.origin, icon: "/favicon.ico" },
            authorizationResultCache: createDefaultAuthorizationResultCache(),
            chain: "solana:mainnet",
            onWalletNotFound: createDefaultWalletNotFoundHandler(),
          }),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Real adapter instances are passed to the official WalletProvider. Backpack
  // and other current extensions additionally register through Wallet Standard.
  // The picker only offers these legacy adapters on desktop when Installed, so
  // their Loadable website fallbacks can never redirect an extension user.
  const wallets = useMemo(
    () => [
      ...(mobileAdapter ? [mobileAdapter as never] : []),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    [mobileAdapter],
  );


  const onError = useCallback((error: Error & { name?: string }) => {
    const name = error.name ?? "";
    const message = error.message ?? "";
    if (/WalletNotSelected/i.test(name)) return;
    if (/User rejected|WalletConnectionError.*reject|rejected the request/i.test(`${name} ${message}`)) {
      toast.error("Connection cancelled in your wallet");
      return;
    }
    if (/WalletNotReadyError|NotInstalled/i.test(name)) {
      toast.error("That wallet isn't installed in this browser", {
        description: "Install the extension, or open SOLIQ inside the wallet app's browser on mobile.",
      });
      return;
    }
    toast.error("Wallet error", { description: message.slice(0, 140) || name || undefined });
  }, []);

  const ctx = useMemo(() => ({ cluster, setCluster, endpoint }), [cluster, setCluster, endpoint]);

  return (
    <ClusterContext.Provider value={ctx}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect onError={onError} localStorageKey="soliq.wallet">
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ClusterContext.Provider>
  );
}
