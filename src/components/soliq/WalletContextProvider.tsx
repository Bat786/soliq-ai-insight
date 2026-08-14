import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo, type ReactNode } from "react";

import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Real Solana wallet-adapter context. Backpack, Glow and every other
 * Wallet-Standard wallet is auto-detected by the adapter, so only the two
 * legacy injected adapters need to be listed explicitly.
 */
export function WalletContextProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl("mainnet-beta"), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
