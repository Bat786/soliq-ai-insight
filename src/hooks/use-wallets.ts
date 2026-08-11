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
  ethereum?: EvmProvider;
};

function injected(id: WalletProviderId): SolanaProvider | EvmProvider | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as WalletWindow;
  if (id === "phantom") return w.phantom?.solana;
  if (id === "solflare") return w.solflare;
  if (id === "backpack") return w.backpack;
  return w.ethereum;
}

/** Which supported wallet extensions are actually installed in this browser. */
export function useDetectedWallets() {
  const [available, setAvailable] = useState<Record<WalletProviderId, boolean>>({
    phantom: false,
    solflare: false,
    backpack: false,
    metamask: false,
  });

  useEffect(() => {
    const scan = () =>
      setAvailable({
        phantom: !!injected("phantom"),
        solflare: !!injected("solflare"),
        backpack: !!injected("backpack"),
        metamask: !!injected("metamask"),
      });
    scan();
    const id = setTimeout(scan, 800);
    return () => clearTimeout(id);
  }, []);

  return available;
}

async function connectProvider(id: WalletProviderId): Promise<string> {
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
      const address = await connectProvider(meta.id);
      return runLink({ data: { chain: meta.chain, provider: meta.name, address, label: meta.name } });
    },
    onSuccess: (row) => {
      invalidate();
      toast.success(`${row.provider} linked`, { description: `${row.address.slice(0, 6)}…${row.address.slice(-4)}` });
    },
    onError: (error) => {
      const missing = error instanceof Error && error.message === "wallet-missing";
      toast.error(missing ? "Wallet extension not detected" : "Could not link that wallet", {
        description: missing ? "Install the extension, then reload and try again." : undefined,
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
    remove,
    makePrimary,
  };
}
