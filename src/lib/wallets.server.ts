/**
 * Server-only wallet balance reader.
 *
 * Uses public JSON-RPC endpoints (no keys) for native balances and Binance
 * spot tickers for USD valuation, so linked wallets show real value without
 * any signing or private data ever leaving the browser.
 */

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const EVM_RPC = "https://ethereum-rpc.publicnode.com";
const TICKER = "https://api.binance.com/api/v3/ticker/price";

export type WalletBalance = {
  address: string;
  chain: "solana" | "evm";
  native: number;
  symbol: string;
  usd: number;
};

type CacheEntry = { at: number; value: number };
const cache = new Map<string, CacheEntry>();
const TTL = 60_000;

async function cached(key: string, load: () => Promise<number>): Promise<number> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  try {
    const value = await load();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return hit?.value ?? 0;
  }
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
    const result = (await rpc(SOLANA_RPC, "getBalance", [address, { commitment: "confirmed" }])) as
      | { value?: number }
      | undefined;
    return (result?.value ?? 0) / 1e9;
  });
}

async function ethBalance(address: string): Promise<number> {
  return cached(`eth:${address}`, async () => {
    const hex = (await rpc(EVM_RPC, "eth_getBalance", [address, "latest"])) as string | undefined;
    if (!hex) return 0;
    return Number(BigInt(hex)) / 1e18;
  });
}

export async function loadWalletBalances(
  wallets: { address: string; chain: "solana" | "evm" }[],
): Promise<WalletBalance[]> {
  const [sol, eth] = await Promise.all([price("SOLUSDT").catch(() => 0), price("ETHUSDT").catch(() => 0)]);
  return Promise.all(
    wallets.map(async (w) => {
      const native =
        w.chain === "solana"
          ? await solBalance(w.address).catch(() => 0)
          : await ethBalance(w.address).catch(() => 0);
      const px = w.chain === "solana" ? sol : eth;
      return {
        address: w.address,
        chain: w.chain,
        native,
        symbol: w.chain === "solana" ? "SOL" : "ETH",
        usd: native * px,
      };
    }),
  );
}
