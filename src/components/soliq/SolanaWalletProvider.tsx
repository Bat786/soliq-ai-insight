import "@/lib/node-globals";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useMemo, type ReactNode } from "react";

import { solanaRpcEndpoint } from "@/lib/solanaWallet";

import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Standard wallet-adapter stack, pointed at our Alchemy RPC proxy:
 *   ConnectionProvider -> WalletProvider -> WalletModalProvider
 *
 * `wallets` stays empty on purpose: Phantom, Solflare, Backpack and friends
 * self-register through the Wallet Standard, so hand-built adapter instances
 * would duplicate or shadow the real extensions.
 */
export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => solanaRpcEndpoint(), []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect onError={(error) => console.error(error)}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
