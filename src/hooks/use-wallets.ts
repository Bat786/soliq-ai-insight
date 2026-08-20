import "@/lib/node-globals";

import { useWallet } from "@solana/wallet-adapter-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/hooks/use-soliq-account";
import { linkWallet, listWallets, setPrimaryWallet, unlinkWallet, walletBalances } from "@/lib/wallets.functions";

export type WalletProviderId = "metamask" | "walletconnect";

export type WalletProviderMeta = {
  id: WalletProviderId;
  name: string;
  chain: "solana" | "evm";
  blurb: string;
  site: string;
  /** WalletConnect works without an extension (QR / mobile deep link). */
  universal?: boolean;
};

export const WALLETCONNECT_PROJECT_ID = "3107d184dd8ba1e8a4d698c20ea61dbe";

/**
 * Only EVM wallets are listed here. Solana wallets (Phantom, Solflare,
 * Backpack, Glow…) are handled by the official @solana/wallet-adapter
 * modal, which owns detection, connect and install-redirect logic.
 */
export const walletProviders: WalletProviderMeta[] = [
  { id: "metamask", name: "MetaMask", chain: "evm", blurb: "Ethereum & EVM chains", site: "https://metamask.io" },
  {
    id: "walletconnect",
    name: "WalletConnect",
    chain: "evm",
    blurb: "Any EVM wallet · scan a QR from mobile",
    site: "https://walletconnect.network",
    universal: true,
  },
];


type EvmProvider = {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type WalletWindow = Window & {
  ethereum?: EvmProvider & { providers?: EvmProvider[] };
};

/** Resolve the injected provider for a wallet, tolerating every known injection shape. */
function injected(id: WalletProviderId): EvmProvider | undefined {
  if (typeof window === "undefined") return undefined;
  const eth = (window as WalletWindow).ethereum;
  if (!eth) return undefined;
  if (id === "metamask") return eth.providers?.find((p) => p.isMetaMask) ?? eth;
  return eth;
}

/** Which supported wallet extensions are actually installed in this browser. */
export function useDetectedWallets() {
  const [available, setAvailable] = useState<Record<WalletProviderId, boolean>>({
    metamask: false,
    walletconnect: true,
  });

  useEffect(() => {
    const scan = () => setAvailable({ metamask: !!injected("metamask"), walletconnect: true });
    scan();
    // Extensions inject asynchronously — poll briefly and listen for EIP-6963.
    const timers = [150, 400, 900, 1800].map((ms) => window.setTimeout(scan, ms));
    window.addEventListener("eip6963:announceProvider", scan as EventListener);
    window.addEventListener("ethereum#initialized", scan);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("eip6963:announceProvider", scan as EventListener);
      window.removeEventListener("ethereum#initialized", scan);
    };
  }, []);

  return available;
}


/** WalletConnect (Reown) session — works with any mobile or desktop EVM wallet. */
async function connectWalletConnect(): Promise<string> {
  const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
  const provider = await EthereumProvider.init({
    projectId: WALLETCONNECT_PROJECT_ID,
    chains: [1],
    optionalChains: [8453, 42161, 137, 10],
    showQrModal: true,
    metadata: {
      name: "SOLIQ",
      description: "SOLIQ — powered by AETHRON, Solana Blockchain Intelligence Engine",
      url: typeof window === "undefined" ? "https://soliq.app" : window.location.origin,
      icons: [`${typeof window === "undefined" ? "" : window.location.origin}/favicon.ico`],
    },
  });
  await provider.connect();
  const address = provider.accounts?.[0];
  if (!address) throw new Error("No account returned");
  return address;
}

async function connectProvider(id: WalletProviderId): Promise<string> {
  if (id === "walletconnect") return connectWalletConnect();
  const provider = injected(id);
  if (!provider) throw new Error("wallet-missing");
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("No account returned");
  return address;
}

export function useWallets() {
  const { isSignedIn } = useSession();
  const queryClient = useQueryClient();
  const fetchWallets = useServerFn(listWallets);
  const fetchBalances = useServerFn(walletBalances);
  const runLink = useServerFn(linkWallet);
  const runUnlink = useServerFn(unlinkWallet);
  const runPrimary = useServerFn(setPrimaryWallet);

  const wallets = useQuery({ queryKey: ["wallets"], queryFn: () => fetchWallets(), enabled: isSignedIn });
  const balances = useQuery({
    queryKey: ["wallet-balances"],
    queryFn: () => fetchBalances(),
    enabled: isSignedIn && (wallets.data?.length ?? 0) > 0,
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["wallets"] });
    void queryClient.invalidateQueries({ queryKey: ["wallet-balances"] });
  };

  const connect = useMutation({
    mutationFn: async (meta: WalletProviderMeta) => {
      if (!isSignedIn) throw new Error("signed-out");
      const address = await connectProvider(meta.id);
      return runLink({ data: { chain: meta.chain, provider: meta.name, address, label: meta.name } });
    },
    onSuccess: (row) => {
      invalidate();
      toast.success(`${row.provider} linked`, { description: `${row.address.slice(0, 6)}…${row.address.slice(-4)}` });
    },
    onError: (error) => {
      const code = error instanceof Error ? error.message : "";
      if (code === "signed-out") {
        toast.error("Sign in first", { description: "Wallets are linked to your SOLIQ account." });
        return;
      }
      if (code === "wallet-missing") {
        toast.error("Wallet extension not detected", {
          description: "Unlock the extension (or open SOLIQ in the wallet's browser on mobile) and try again.",
        });
        return;
      }

      const rejected = /reject|denied|4001|closed/i.test(code);
      toast.error(rejected ? "Connection cancelled in your wallet" : "Could not link that wallet", {
        description: rejected ? undefined : code.slice(0, 140) || undefined,
      });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => runUnlink({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Wallet unlinked");
    },
    onError: () => toast.error("Could not unlink that wallet"),
  });

  const makePrimary = useMutation({
    mutationFn: (id: string) => runPrimary({ data: { id } }),
    onSuccess: invalidate,
  });

  /** Track any public address read-only, no wallet app required. */
  const watch = useMutation({
    mutationFn: async (address: string) => {
      const value = address.trim();
      const isEvm = /^0x[a-fA-F0-9]{40}$/.test(value);
      const isSol = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
      if (!isSignedIn) throw new Error("signed-out");
      if (!isEvm && !isSol) throw new Error("bad-address");
      return runLink({
        data: {
          chain: isEvm ? "evm" : "solana",
          provider: "Watch",
          address: value,
          label: "Watched address",
        },
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Address added to your watch list");
    },
    onError: (error) => {
      const code = error instanceof Error ? error.message : "";
      toast.error(
        code === "bad-address" ? "That doesn't look like a Solana or EVM address"
        : code === "signed-out" ? "Sign in first to track addresses"
        : "Could not track that address",
      );
    },
  });

  const balanceFor = (address: string) => balances.data?.find((b) => b.address === address);
  const totalUsd = (balances.data ?? []).reduce((sum, b) => sum + b.usd, 0);

  return {
    isSignedIn,
    wallets: wallets.data ?? [],
    loading: wallets.isLoading,
    balances: balances.data ?? [],
    balanceFor,
    totalUsd,
    connect,
    watch,
    remove,
    makePrimary,

  };
}


/**
 * Bridges the official Solana wallet-adapter session into SOLIQ's linked
 * wallets: as soon as a real wallet connects, its public key is stored
 * read-only on the account.
 */
export function useSolanaAdapterLink() {
  const { publicKey, connected, wallet, disconnect } = useWallet();
  const { isSignedIn } = useSession();
  const queryClient = useQueryClient();
  const runLink = useServerFn(linkWallet);
  const linkedRef = useRef<string | null>(null);

  const address = publicKey?.toBase58() ?? null;
  const providerName = wallet?.adapter.name ?? "Solana wallet";

  useEffect(() => {
    if (!connected || !address) return;
    if (!isSignedIn) {
      if (linkedRef.current === `guest:${address}`) return;
      linkedRef.current = `guest:${address}`;
      toast.info(`${providerName} connected`, { description: "Sign in to save this wallet to your SOLIQ account." });
      return;
    }

    if (linkedRef.current === address) return;
    linkedRef.current = address;
    void runLink({ data: { chain: "solana", provider: providerName, address, label: providerName } })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["wallets"] });
        void queryClient.invalidateQueries({ queryKey: ["wallet-balances"] });
        toast.success(`${providerName} linked`, {
          description: `${address.slice(0, 6)}…${address.slice(-4)}`,
        });
      })
      .catch(() => toast.error("Could not link that wallet"));
  }, [address, connected, isSignedIn, providerName, queryClient, runLink]);

  return { address, connected, providerName, disconnect };
}
