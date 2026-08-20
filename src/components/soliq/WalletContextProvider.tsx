import "@/lib/node-globals";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { solanaRpcEndpoint } from "@/lib/solanaWallet";

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
 * Official @solana/wallet-adapter setup:
 *
 *   ConnectionProvider -> WalletProvider (wallets=[]) -> WalletModalProvider
 *
 * The wallets array is intentionally EMPTY. Phantom, Solflare, Backpack and
 * Magic Eden Wallet all self-register through the Wallet Standard, so the
 * adapter detects installed extensions on its own. Hand-constructed adapter
 * instances would duplicate or shadow those registrations.
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

  // All RPC traffic goes through our same-origin Alchemy proxy, so the API key
  // never reaches the browser. Network is set by VITE_SOLANA_NETWORK.
  const endpoint = useMemo(() => solanaRpcEndpoint(), []);

  const ctx = useMemo(() => ({ cluster, setCluster, endpoint }), [cluster, setCluster, endpoint]);

  return (
    <ClusterContext.Provider value={ctx}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={[]} autoConnect onError={(error) => console.error(error)}>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ClusterContext.Provider>
  );
}
