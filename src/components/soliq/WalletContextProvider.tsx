import "@/lib/node-globals";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { solanaRpcEndpoint } from "@/lib/solanaWallet";

import "@solana/wallet-adapter-react-ui/styles.css";

export type Cluster = "devnet";

const CLUSTER_KEY = "soliq.cluster";

type ClusterCtx = { cluster: Cluster; setCluster: (c: Cluster) => void; endpoint: string };
const ClusterContext = createContext<ClusterCtx>({
  cluster: "devnet",
  setCluster: () => undefined,
  endpoint: "/api/public/solana-rpc",
});

/** Which Solana cluster the terminal is reading from. */
export const useCluster = () => useContext(ClusterContext);

/**
 * Official @solana/wallet-adapter setup:
 *
 *   ConnectionProvider -> WalletProvider (wallets) -> WalletModalProvider
 *
 * Phantom + Solflare adapters are passed explicitly so MOBILE works: with no
 * injected extension (mobile Safari/Chrome) these adapters deep-link into the
 * wallet app instead of the modal showing an empty "you'll need a wallet"
 * state. On desktop, wallet-adapter dedupes them against the same wallets
 * self-registered through the Wallet Standard, so there is no duplication.
 */
export function WalletContextProvider({ children }: { children: ReactNode }) {
  const [cluster, setClusterState] = useState<Cluster>("devnet");

  // localStorage is browser-only — hydrate after mount to avoid SSR mismatch.
  useEffect(() => {
    const stored = window.localStorage.getItem(CLUSTER_KEY);
    if (stored === "devnet") setClusterState(stored);
  }, []);

  const setCluster = useCallback((next: Cluster) => {
    setClusterState(next);
    window.localStorage.setItem(CLUSTER_KEY, next);
  }, []);

  // All RPC traffic goes through our same-origin Alchemy proxy, so the API key
  // never reaches the browser. Network is set by VITE_SOLANA_NETWORK.
  const endpoint = useMemo(() => solanaRpcEndpoint(), []);

  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  const ctx = useMemo(() => ({ cluster, setCluster, endpoint }), [cluster, setCluster, endpoint]);

  return (
    <ClusterContext.Provider value={ctx}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect onError={(error) => console.error(error)}>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ClusterContext.Provider>
  );
}
