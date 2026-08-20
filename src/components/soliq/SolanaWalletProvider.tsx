import "@/lib/node-globals";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { useMemo, type ReactNode } from "react";

import { solanaRpcEndpoint } from "@/lib/solanaWallet";

import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Standard wallet-adapter stack, pointed at our Alchemy RPC proxy:
 *   ConnectionProvider -> WalletProvider -> WalletModalProvider
 *
 * Phantom + Solflare adapters are listed explicitly so mobile browsers (no
 * injected extension) deep-link into the wallet app. Desktop extensions still
 * register through the Wallet Standard and are deduped by wallet-adapter.
 */
export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => solanaRpcEndpoint(), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={(error) => console.error(error)}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
