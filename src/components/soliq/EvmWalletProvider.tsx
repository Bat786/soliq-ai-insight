import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { WALLETCONNECT_PROJECT_ID } from "@/hooks/use-wallets";

/**
 * EVM side of the wallet stack. Deliberately kept in its own provider/context —
 * Solana lives in WalletContextProvider on the official wallet-adapter, and the
 * two never share state or libraries.
 */
export type EvmConnectorId = "metamask" | "walletconnect";

type EvmProvider = {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
};

type EvmCtx = {
  address: string | null;
  chainId: number | null;
  connected: boolean;
  connecting: boolean;
  connectorId: EvmConnectorId | null;
  /** True when a MetaMask-compatible extension is injected in this browser. */
  metamaskDetected: boolean;
  connect: (id: EvmConnectorId) => Promise<void>;
  disconnect: () => void;
};

const EvmContext = createContext<EvmCtx>({
  address: null,
  chainId: null,
  connected: false,
  connecting: false,
  connectorId: null,
  metamaskDetected: false,
  connect: async () => undefined,
  disconnect: () => undefined,
});

/** Connected EVM wallet (MetaMask / WalletConnect) for portfolio and dashboard reads. */
export const useEvmWallet = () => useContext(EvmContext);

const STORE_KEY = "soliq.evm.connector";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum",
};

export const evmChainName = (id: number | null) =>
  id ? (CHAIN_NAMES[id] ?? `Chain ${id}`) : null;

function injectedEvm(): EvmProvider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as Window & { ethereum?: EvmProvider & { providers?: EvmProvider[] } }).ethereum;
  if (!eth) return null;
  if (eth.providers?.length) return eth.providers.find((p) => p.isMetaMask) ?? eth.providers[0]!;
  return eth;
}

export function EvmWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectorId, setConnectorId] = useState<EvmConnectorId | null>(null);
  const [metamaskDetected, setMetamaskDetected] = useState(false);
  const [active, setActive] = useState<EvmProvider | null>(null);

  // Extensions inject asynchronously; EIP-6963 announcements land after mount.
  useEffect(() => {
    const scan = () => setMetamaskDetected(!!injectedEvm());
    scan();
    const timers = [200, 600, 1500].map((ms) => window.setTimeout(scan, ms));
    window.addEventListener("eip6963:announceProvider", scan as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("eip6963:announceProvider", scan as EventListener);
    };
  }, []);

  const adopt = useCallback(async (provider: EvmProvider, id: EvmConnectorId, account: string) => {
    setActive(provider);
    setAddress(account);
    setConnectorId(id);
    try {
      const hex = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(Number.parseInt(hex, 16));
    } catch {
      setChainId(null);
    }
    window.localStorage.setItem(STORE_KEY, id);
  }, []);

  const connect = useCallback(
    async (id: EvmConnectorId) => {
      setConnecting(true);
      try {
        if (id === "walletconnect") {
          const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
          const wc = await EthereumProvider.init({
            projectId: WALLETCONNECT_PROJECT_ID,
            chains: [1],
            optionalChains: [8453, 42161, 137, 10],
            showQrModal: true,
            metadata: {
              name: "SOLIQ",
              description: "SOLIQ — powered by AETHRON",
              url: window.location.origin,
              icons: [`${window.location.origin}/favicon.ico`],
            },
          });
          await wc.connect();
          const account = wc.accounts?.[0];
          if (!account) throw new Error("No account returned");
          await adopt(wc as unknown as EvmProvider, id, account);
        } else {
          const provider = injectedEvm();
          if (!provider) {
            const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
            if (mobile) {
              window.location.href = `https://metamask.app.link/dapp/${window.location.href.replace(/^https?:\/\//, "")}`;
              return;
            }
            toast.error("MetaMask not detected", {
              description: "Install the extension, or use WalletConnect to pair a mobile wallet.",
            });
            return;
          }
          const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
          const account = accounts?.[0];
          if (!account) throw new Error("No account returned");
          await adopt(provider, id, account);
        }
        toast.success("EVM wallet connected");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        toast.error(/reject|denied|4001|closed/i.test(msg) ? "Connection cancelled in your wallet" : "Could not connect", {
          description: /reject|denied|4001|closed/i.test(msg) ? undefined : msg.slice(0, 140) || undefined,
        });
      } finally {
        setConnecting(false);
      }
    },
    [adopt],
  );

  const disconnect = useCallback(() => {
    const provider = active as (EvmProvider & { disconnect?: () => Promise<void> }) | null;
    void provider?.disconnect?.().catch(() => undefined);
    setActive(null);
    setAddress(null);
    setChainId(null);
    setConnectorId(null);
    window.localStorage.removeItem(STORE_KEY);
  }, [active]);

  // Silent reconnect for injected wallets the browser already authorised.
  useEffect(() => {
    if (address || window.localStorage.getItem(STORE_KEY) !== "metamask") return;
    const provider = injectedEvm();
    if (!provider) return;
    void provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const account = (accounts as string[])?.[0];
        if (account) void adopt(provider, "metamask", account);
      })
      .catch(() => undefined);
  }, [address, adopt, metamaskDetected]);

  // Reflect account/chain switches made inside the wallet.
  useEffect(() => {
    if (!active?.on) return;
    const onAccounts = (accounts: string[]) => (accounts?.[0] ? setAddress(accounts[0]) : disconnect());
    const onChain = (hex: string) => setChainId(Number.parseInt(hex, 16));
    active.on("accountsChanged", onAccounts);
    active.on("chainChanged", onChain);
    return () => {
      active.removeListener?.("accountsChanged", onAccounts);
      active.removeListener?.("chainChanged", onChain);
    };
  }, [active, disconnect]);

  const value = useMemo<EvmCtx>(
    () => ({
      address,
      chainId,
      connected: !!address,
      connecting,
      connectorId,
      metamaskDetected,
      connect,
      disconnect,
    }),
    [address, chainId, connecting, connectorId, metamaskDetected, connect, disconnect],
  );

  return <EvmContext.Provider value={value}>{children}</EvmContext.Provider>;
}
