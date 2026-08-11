import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/hooks/use-soliq-account";
import { linkWallet, listWallets, setPrimaryWallet, unlinkWallet, walletBalances } from "@/lib/wallets.functions";

export type WalletProviderId = "phantom" | "solflare" | "backpack" | "metamask" | "walletconnect";

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

export const walletProviders: WalletProviderMeta[] = [
  { id: "phantom", name: "Phantom", chain: "solana", blurb: "Solana · the default power wallet", site: "https://phantom.app" },
  { id: "solflare", name: "Solflare", chain: "solana", blurb: "Solana · staking native", site: "https://solflare.com" },
  { id: "backpack", name: "Backpack", chain: "solana", blurb: "Solana · xNFT terminal", site: "https://backpack.app" },
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


type SolanaProvider = {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  publicKey?: { toString: () => string } | null;
};

type EvmProvider = {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type WalletWindow = Window & {
  phantom?: { solana?: SolanaProvider };
  solflare?: SolanaProvider;
  backpack?: SolanaProvider;
  xnft?: { solana?: SolanaProvider };
  solana?: SolanaProvider & { isSolflare?: boolean; isBackpack?: boolean };
  ethereum?: EvmProvider & { providers?: EvmProvider[] };
};

/** Resolve the injected provider for a wallet, tolerating every known injection shape. */
function injected(id: WalletProviderId): SolanaProvider | EvmProvider | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as WalletWindow;
  if (id === "phantom") return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : undefined);
  if (id === "solflare") return w.solflare ?? (w.solana?.isSolflare ? w.solana : undefined);
  if (id === "backpack") return w.backpack ?? w.xnft?.solana ?? (w.solana?.isBackpack ? w.solana : undefined);
  if (id === "metamask") {
    const eth = w.ethereum;
    if (!eth) return undefined;
    const multi = eth.providers?.find((p) => p.isMetaMask);
    return multi ?? eth;
  }
  return w.ethereum;
}

/** Which supported wallet extensions are actually installed in this browser. */
export function useDetectedWallets() {
  const [available, setAvailable] = useState<Record<WalletProviderId, boolean>>({
    phantom: false,
    solflare: false,
    backpack: false,
    metamask: false,
    walletconnect: true,
  });

  useEffect(() => {
    const scan = () =>
      setAvailable({
        phantom: !!injected("phantom"),
        solflare: !!injected("solflare"),
        backpack: !!injected("backpack"),
        metamask: !!injected("metamask"),
        walletconnect: true,
      });
    scan();
    const id = setTimeout(scan, 800);
    return () => clearTimeout(id);
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
      description: "SOLIQ — powered by SOLIQ, Solana Blockchain Intelligence Engine",
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
  if (id === "metamask") {
    const accounts = (await (provider as EvmProvider).request({ method: "eth_requestAccounts" })) as string[];
    const address = accounts?.[0];
    if (!address) throw new Error("No account returned");
    return address;
  }
  const res = await (provider as SolanaProvider).connect();
  return res.publicKey.toString();
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
          description: "Install the extension, then reload and try again.",
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
