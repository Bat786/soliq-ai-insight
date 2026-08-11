/**
 * Server-only wallet reader.
 *
 * Native balances come from Alchemy when a key is configured (falling back to
 * public JSON-RPC), token holdings come from Alchemy's enhanced APIs, and USD
 * valuation uses Binance spot tickers. Nothing here ever signs or spends.
 */

const PUBLIC_SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const PUBLIC_EVM_RPC = "https://ethereum-rpc.publicnode.com";
const TICKER = "https://api.binance.com/api/v3/ticker/price";

export type WalletToken = {
  symbol: string;
  name: string;
  amount: number;
  usd: number;
};

export type WalletBalance = {
  address: string;
  chain: "solana" | "evm";
  native: number;
  symbol: string;
  usd: number;
  tokens: WalletToken[];
};

type CacheEntry<T> = { at: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();
const TTL = 60_000;

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  try {
    const value = await load();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    if (hit) return hit.value;
    throw error;
  }
}

function alchemyUrl(chain: "solana" | "evm"): string | null {
  const key = process.env["ALCHEMY_API_KEY"];
  if (!key) return null;
  const host = chain === "solana" ? "solana-mainnet" : "eth-mainnet";
  return `https://${host}.g.alchemy.com/v2/${key}`;
}

function rpcUrl(chain: "solana" | "evm"): string {
  return alchemyUrl(chain) ?? (chain === "solana" ? PUBLIC_SOLANA_RPC : PUBLIC_EVM_RPC);
}

async function price(symbol: string): Promise<number> {
  return cached(`px:${symbol}`, async () => {
    const res = await fetch(`${TICKER}?symbol=${symbol}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`ticker ${res.status}`);
    const json = (await res.json()) as { price?: string };
    return Number(json.price ?? 0);
  });
}

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`${method} ${res.status}`);
  const json = (await res.json()) as { result?: unknown };
  return json.result;
}

async function solBalance(address: string): Promise<number> {
  return cached(`sol:${address}`, async () => {
    const result = (await rpc(rpcUrl("solana"), "getBalance", [address, { commitment: "confirmed" }])) as
      | { value?: number }
      | undefined;
    return (result?.value ?? 0) / 1e9;
  });
}

async function ethBalance(address: string): Promise<number> {
  return cached(`eth:${address}`, async () => {
    const hex = (await rpc(rpcUrl("evm"), "eth_getBalance", [address, "latest"])) as string | undefined;
    if (!hex) return 0;
    return Number(BigInt(hex)) / 1e18;
  });
}

/** SPL token positions (amount > 0) for a Solana wallet. */
async function solTokens(address: string): Promise<WalletToken[]> {
  return cached(`sol-tokens:${address}`, async () => {
    const result = (await rpc(rpcUrl("solana"), "getTokenAccountsByOwner", [
      address,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ])) as
      | {
          value?: {
            account: {
              data: {
                parsed?: {
                  info?: { mint?: string; tokenAmount?: { uiAmount?: number | null; decimals?: number } };
                };
              };
            };
          }[];
        }
      | undefined;

    const rows = (result?.value ?? [])
      .map((entry) => {
        const info = entry.account.data.parsed?.info;
        return {
          mint: info?.mint ?? "",
          amount: Number(info?.tokenAmount?.uiAmount ?? 0),
        };
      })
      .filter((row) => row.mint && row.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 12);

    return rows.map((row) => ({
      symbol: `${row.mint.slice(0, 4)}…${row.mint.slice(-4)}`,
      name: "SPL token",
      amount: row.amount,
      usd: 0,
    }));
  });
}

/** ERC-20 positions with metadata for an EVM wallet (Alchemy enhanced API). */
async function evmTokens(address: string): Promise<WalletToken[]> {
  const url = alchemyUrl("evm");
  if (!url) return [];
  return cached(`evm-tokens:${address}`, async () => {
    const result = (await rpc(url, "alchemy_getTokenBalances", [address, "erc20"])) as
      | { tokenBalances?: { contractAddress: string; tokenBalance: string | null }[] }
      | undefined;

    const held = (result?.tokenBalances ?? [])
      .filter((t) => t.tokenBalance && BigInt(t.tokenBalance) > 0n)
      .slice(0, 10);

    const metas = await Promise.all(
      held.map(async (t) => {
        try {
          const meta = (await rpc(url, "alchemy_getTokenMetadata", [t.contractAddress])) as
            | { symbol?: string; name?: string; decimals?: number }
            | undefined;
          const decimals = meta?.decimals ?? 18;
          const amount = Number(BigInt(t.tokenBalance!)) / 10 ** decimals;
          return {
            symbol: meta?.symbol ?? t.contractAddress.slice(0, 6),
            name: meta?.name ?? "ERC-20",
            amount,
            usd: 0,
          } satisfies WalletToken;
        } catch {
          return null;
        }
      }),
    );

    return metas
      .filter((t): t is WalletToken => !!t && t.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  });
}

export async function loadWalletBalances(
  wallets: { address: string; chain: "solana" | "evm" }[],
): Promise<WalletBalance[]> {
  const [sol, eth] = await Promise.all([price("SOLUSDT").catch(() => 0), price("ETHUSDT").catch(() => 0)]);
  return Promise.all(
    wallets.map(async (w) => {
      const isSol = w.chain === "solana";
      const [native, tokens] = await Promise.all([
        (isSol ? solBalance(w.address) : ethBalance(w.address)).catch(() => 0),
        (isSol ? solTokens(w.address) : evmTokens(w.address)).catch(() => [] as WalletToken[]),
      ]);
      const px = isSol ? sol : eth;
      return {
        address: w.address,
        chain: w.chain,
        native,
        symbol: isSol ? "SOL" : "ETH",
        usd: native * px,
        tokens,
      };
    }),
  );
}
