/**
 * Stablecoin desk data — server only.
 *
 * Two very different sources, deliberately kept apart:
 *   Massive  → off-chain market data (price, peg deviation, 24h volume, range)
 *   Alchemy  → on-chain truth (SPL mint supply, and a wallet's token balances)
 *
 * Neither the Massive key nor the Alchemy key is ever exposed to the browser:
 * this module is imported only from server functions.
 */

import { massiveConfigured, massiveDailyBars, massivePrevBar } from "@/lib/massive.server";
import { alchemyRpcUrl, solanaNetwork } from "@/lib/solanaWallet.server";

export type StablecoinRow = {
  symbol: string;
  name: string;
  /** Massive crypto pair, e.g. USDCUSD. */
  pair: string;
  peg: number;
  price: number;
  /** Signed deviation from peg in basis points. */
  pegBps: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  /** Max |deviation| over the trailing window, in bps. */
  worstBps: number;
  series: number[];
  /** On-chain circulating supply on the active Solana cluster, when the mint is known. */
  onchainSupply: number | null;
  /** onchainSupply * price. */
  onchainCap: number | null;
  mint: string | null;
  status: "stable" | "drift" | "broken" | "no-data";
};

export type StablecoinDesk = {
  network: string;
  rows: StablecoinRow[];
  totals: { onchainCap: number; volume24h: number; tracked: number };
  notes: string[];
  updatedAt: string;
};

type Coin = { symbol: string; name: string; pair: string; peg: number; mints: Partial<Record<string, string>> };

/** Majors plus the fiat-pegged pairs Massive quotes. */
const COINS: Coin[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    pair: "USDCUSD",
    peg: 1,
    mints: {
      "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    },
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    pair: "USDTUSD",
    peg: 1,
    mints: { "mainnet-beta": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
  },
  { symbol: "DAI", name: "Dai", pair: "DAIUSD", peg: 1, mints: {} },
  { symbol: "PYUSD", name: "PayPal USD", pair: "PYUSDUSD", peg: 1, mints: {} },
  { symbol: "EURC", name: "Euro Coin", pair: "EURCEUR", peg: 1, mints: {} },
];

const bps = (price: number, peg: number) => ((price - peg) / peg) * 10_000;

const classify = (price: number, deviation: number): StablecoinRow["status"] => {
  if (!price) return "no-data";
  const abs = Math.abs(deviation);
  if (abs <= 30) return "stable";
  if (abs <= 150) return "drift";
  return "broken";
};

/** Alchemy JSON-RPC (server side, real key). */
async function alchemyRpc<T>(method: string, params: unknown[]): Promise<T | null> {
  try {
    const res = await fetch(alchemyRpcUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T };
    return json.result ?? null;
  } catch {
    return null;
  }
}

async function mintSupply(mint: string): Promise<number | null> {
  const result = await alchemyRpc<{ value?: { uiAmount?: number | null } }>("getTokenSupply", [mint]);
  const ui = result?.value?.uiAmount;
  return typeof ui === "number" ? ui : null;
}

async function loadRow(coin: Coin, network: string, notes: string[]): Promise<StablecoinRow> {
  const mint = coin.mints[network] ?? null;
  const [prev, daily, supply] = await Promise.all([
    massivePrevBar("crypto", coin.pair).catch(() => null),
    massiveDailyBars("crypto", coin.pair, 45).catch(() => null),
    mint ? mintSupply(mint).catch(() => null) : Promise.resolve(null),
  ]);

  const bars = daily ?? [];
  const last = bars.at(-1) ?? prev;
  const price = last?.close ?? 0;
  const priorClose = bars.length > 1 ? (bars.at(-2)?.close ?? price) : (prev?.open ?? price);
  const series = bars.slice(-30).map((b) => b.close);
  const deviation = price ? bps(price, coin.peg) : 0;
  const worst = series.length ? Math.max(...series.map((p) => Math.abs(bps(p, coin.peg)))) : Math.abs(deviation);

  if (!price) notes.push(`${coin.symbol}: no Massive quote for ${coin.pair}`);

  return {
    symbol: coin.symbol,
    name: coin.name,
    pair: coin.pair,
    peg: coin.peg,
    price,
    pegBps: deviation,
    change24h: priorClose ? ((price - priorClose) / priorClose) * 100 : 0,
    volume24h: last?.volume ?? 0,
    high24h: last?.high ?? 0,
    low24h: last?.low ?? 0,
    worstBps: worst,
    series,
    onchainSupply: supply,
    onchainCap: supply && price ? supply * price : null,
    mint,
    status: classify(price, deviation),
  };
}

/** Full stablecoin desk: Massive market data + Alchemy on-chain supply. */
export async function loadStablecoinDesk(): Promise<StablecoinDesk> {
  const network = solanaNetwork();
  const notes: string[] = [];
  if (!massiveConfigured()) notes.push("MASSIVE_API_KEY missing — market data unavailable");

  const rows = await Promise.all(COINS.map((c) => loadRow(c, network, notes)));
  const priced = rows.filter((r) => r.price > 0);

  return {
    network,
    rows: rows.sort((a, b) => (b.onchainCap ?? 0) - (a.onchainCap ?? 0) || Math.abs(b.pegBps) - Math.abs(a.pegBps)),
    totals: {
      onchainCap: rows.reduce((sum, r) => sum + (r.onchainCap ?? 0), 0),
      volume24h: rows.reduce((sum, r) => sum + r.volume24h, 0),
      tracked: priced.length,
    },
    notes,
    updatedAt: new Date().toISOString(),
  };
}

export type StableBalance = { symbol: string; mint: string; amount: number; accounts: number };

/** A wallet's on-chain stablecoin balances on the active cluster (Alchemy). */
export async function loadStablecoinBalances(owner: string): Promise<{ network: string; balances: StableBalance[] }> {
  const network = solanaNetwork();
  const targets = COINS.map((c) => ({ symbol: c.symbol, mint: c.mints[network] })).filter(
    (t): t is { symbol: string; mint: string } => Boolean(t.mint),
  );

  const balances = await Promise.all(
    targets.map(async ({ symbol, mint }) => {
      const result = await alchemyRpc<{
        value?: { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } } }[];
      }>("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }]);
      const accounts = result?.value ?? [];
      const amount = accounts.reduce(
        (sum, a) => sum + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0),
        0,
      );
      return { symbol, mint, amount, accounts: accounts.length };
    }),
  );

  return { network, balances };
}
