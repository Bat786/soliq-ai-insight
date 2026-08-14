/**
 * Server-only wallet activity + P&L reader.
 *
 * Pulls real transaction history straight from the chain (Solana JSON-RPC,
 * Alchemy asset transfers for EVM), values every historical flow with the
 * daily close from Binance, then runs an average-cost book to produce realized
 * and unrealized P&L. Read-only: nothing here signs, spends or approves.
 */

export type Cluster = "mainnet-beta" | "devnet";

export type WalletTx = {
  hash: string;
  time: number;
  direction: "in" | "out" | "self";
  amount: number;
  symbol: string;
  usdAtTime: number | null;
  feeNative: number;
  status: "success" | "failed";
  explorer: string;
};

export type WalletPnl = {
  symbol: string;
  quantity: number;
  avgCost: number | null;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealized: number;
  unrealizedPct: number | null;
  realized: number;
  totalIn: number;
  totalOut: number;
  feesNative: number;
  trades: number;
};

export type WalletActivity = {
  address: string;
  chain: "solana" | "evm";
  cluster: Cluster;
  symbol: string;
  txs: WalletTx[];
  pnl: WalletPnl | null;
  notes: string[];
  updatedAt: number;
};

const PUBLIC_SOLANA: Record<Cluster, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
};
const PUBLIC_EVM = "https://ethereum-rpc.publicnode.com";
const KLINES = "https://api.binance.com/api/v3/klines";
const TICKER = "https://api.binance.com/api/v3/ticker/price";

type Entry<T> = { at: number; value: T };
const cache = new Map<string, Entry<unknown>>();

async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  try {
    const value = await load();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    if (hit) return hit.value;
    throw error;
  }
}

function alchemy(chain: "solana" | "evm", cluster: Cluster): string | null {
  const key = process.env["ALCHEMY_API_KEY"];
  if (!key) return null;
  const host =
    chain === "solana" ? (cluster === "devnet" ? "solana-devnet" : "solana-mainnet") : "eth-mainnet";
  return `https://${host}.g.alchemy.com/v2/${key}`;
}

const solanaRpc = (cluster: Cluster) => alchemy("solana", cluster) ?? PUBLIC_SOLANA[cluster];
const evmRpc = () => alchemy("evm", "mainnet-beta") ?? PUBLIC_EVM;

async function rpcBatch(url: string, calls: { method: string; params: unknown[] }[]): Promise<unknown[]> {
  if (calls.length === 0) return [];
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(calls.map((c, i) => ({ jsonrpc: "2.0", id: i + 1, ...c }))),
  });
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const json = (await res.json()) as { id?: number; result?: unknown }[] | { result?: unknown };
  const rows = Array.isArray(json) ? json : [json];
  const out: unknown[] = new Array(calls.length).fill(null);
  for (const row of rows) {
    const idx = (row.id ?? 1) - 1;
    if (idx >= 0 && idx < out.length) out[idx] = row.result ?? null;
  }
  return out;
}

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  return (await rpcBatch(url, [{ method, params }]))[0] ?? null;
}

/** Daily close history keyed by YYYY-MM-DD, used to value historical flows. */
async function dailyCloses(pair: string): Promise<Map<string, number>> {
  return cached(`kl:${pair}`, 30 * 60_000, async () => {
    const res = await fetch(`${KLINES}?symbol=${pair}&interval=1d&limit=1000`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`klines ${res.status}`);
    const rows = (await res.json()) as unknown[][];
    const map = new Map<string, number>();
    for (const r of rows) {
      const day = new Date(Number(r[0])).toISOString().slice(0, 10);
      map.set(day, Number(r[4]));
    }
    return map;
  });
}

async function spot(pair: string): Promise<number> {
  return cached(`px:${pair}`, 60_000, async () => {
    const res = await fetch(`${TICKER}?symbol=${pair}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`ticker ${res.status}`);
    const json = (await res.json()) as { price?: string };
    return Number(json.price ?? 0);
  });
}

/* ---------------------------------- solana --------------------------------- */

type SolTxMeta = {
  meta?: { fee?: number; err?: unknown; preBalances?: number[]; postBalances?: number[] } | null;
  blockTime?: number | null;
  transaction?: { message?: { accountKeys?: (string | { pubkey?: string })[] } };
};

async function solanaActivity(address: string, cluster: Cluster, limit: number) {
  const url = solanaRpc(cluster);
  const sigs = (await rpc(url, "getSignaturesForAddress", [address, { limit }])) as
    | { signature: string; blockTime?: number | null; err?: unknown }[]
    | null;
  const list = sigs ?? [];
  if (list.length === 0) return { txs: [] as WalletTx[], note: null as string | null };

  const details = (await rpcBatch(
    url,
    list.map((s) => ({
      method: "getTransaction",
      params: [s.signature, { maxSupportedTransactionVersion: 0, encoding: "jsonParsed" }],
    })),
  )) as (SolTxMeta | null)[];

  const closes = await dailyCloses("SOLUSDT").catch(() => new Map<string, number>());
  const txs: WalletTx[] = [];

  for (let i = 0; i < list.length; i++) {
    const sig = list[i]!;
    const tx = details[i];
    const keys = (tx?.transaction?.message?.accountKeys ?? []).map((k) =>
      typeof k === "string" ? k : (k?.pubkey ?? ""),
    );
    const idx = keys.indexOf(address);
    const pre = tx?.meta?.preBalances?.[idx];
    const post = tx?.meta?.postBalances?.[idx];
    const fee = (tx?.meta?.fee ?? 0) / 1e9;
    const delta = pre !== undefined && post !== undefined ? (post - pre) / 1e9 : 0;
    const time = (sig.blockTime ?? tx?.blockTime ?? 0) * 1000;
    // Fees are paid by the signer, so back them out of an outflow amount.
    const isFeePayer = idx === 0;
    const net = isFeePayer ? delta + fee : delta;
    const day = new Date(time || Date.now()).toISOString().slice(0, 10);
    txs.push({
      hash: sig.signature,
      time: time || Date.now(),
      direction: net > 1e-9 ? "in" : net < -1e-9 ? "out" : "self",
      amount: Math.abs(Number(net.toFixed(9))),
      symbol: "SOL",
      usdAtTime: closes.get(day) ?? null,
      feeNative: isFeePayer ? fee : 0,
      status: sig.err || tx?.meta?.err ? "failed" : "success",
      explorer: `https://solscan.io/tx/${sig.signature}${cluster === "devnet" ? "?cluster=devnet" : ""}`,
    });
  }
  return { txs, note: null };
}

/* ------------------------------------ evm ---------------------------------- */

type Transfer = { hash?: string; value?: number | null; metadata?: { blockTimestamp?: string }; from?: string; to?: string };

async function evmActivity(address: string, limit: number) {
  const url = alchemy("evm", "mainnet-beta");
  if (!url) {
    return {
      txs: [] as WalletTx[],
      note: "Ethereum transaction history needs an indexer key — balances stay live, history is unavailable.",
    };
  }
  const call = async (dir: "from" | "to") =>
    (await rpc(url, "alchemy_getAssetTransfers", [
      {
        [dir === "from" ? "fromAddress" : "toAddress"]: address,
        category: ["external", "internal"],
        withMetadata: true,
        maxCount: `0x${limit.toString(16)}`,
        order: "desc",
      },
    ])) as { transfers?: Transfer[] } | null;

  const [out, incoming] = await Promise.all([call("from"), call("to")]);
  const closes = await dailyCloses("ETHUSDT").catch(() => new Map<string, number>());

  const map = (rows: Transfer[] | undefined, direction: "in" | "out"): WalletTx[] =>
    (rows ?? []).map((t) => {
      const time = Date.parse(t.metadata?.blockTimestamp ?? "") || Date.now();
      const day = new Date(time).toISOString().slice(0, 10);
      return {
        hash: t.hash ?? "",
        time,
        direction,
        amount: Number(t.value ?? 0),
        symbol: "ETH",
        usdAtTime: closes.get(day) ?? null,
        feeNative: 0,
        status: "success" as const,
        explorer: `https://etherscan.io/tx/${t.hash ?? ""}`,
      };
    });

  const txs = [...map(out?.transfers, "out"), ...map(incoming?.transfers, "in")]
    .filter((t) => t.hash && t.amount > 0)
    .sort((a, b) => b.time - a.time)
    .slice(0, limit);
  return { txs, note: null as string | null };
}

/* ------------------------------------ P&L ---------------------------------- */

/** Average-cost book over native flows — realized on outflows, unrealized on the balance. */
function book(txs: WalletTx[], symbol: string, currentPrice: number): WalletPnl {
  let qty = 0;
  let basis = 0;
  let realized = 0;
  let totalIn = 0;
  let totalOut = 0;
  let fees = 0;
  let trades = 0;

  for (const tx of [...txs].sort((a, b) => a.time - b.time)) {
    fees += tx.feeNative;
    if (tx.status !== "success" || tx.direction === "self" || tx.amount <= 0) continue;
    const px = tx.usdAtTime ?? currentPrice;
    trades += 1;
    if (tx.direction === "in") {
      qty += tx.amount;
      basis += tx.amount * px;
      totalIn += tx.amount;
    } else {
      const sold = Math.min(qty, tx.amount);
      const avg = qty > 0 ? basis / qty : px;
      realized += sold * (px - avg);
      qty -= sold;
      basis -= sold * avg;
      totalOut += tx.amount;
    }
  }

  const avgCost = qty > 1e-9 ? basis / qty : null;
  const marketValue = qty * currentPrice;
  const unrealized = marketValue - basis;
  return {
    symbol,
    quantity: Number(qty.toFixed(9)),
    avgCost: avgCost === null ? null : Number(avgCost.toFixed(4)),
    currentPrice,
    marketValue: Number(marketValue.toFixed(2)),
    costBasis: Number(basis.toFixed(2)),
    unrealized: Number(unrealized.toFixed(2)),
    unrealizedPct: basis > 1 ? Number(((unrealized / basis) * 100).toFixed(2)) : null,
    realized: Number(realized.toFixed(2)),
    totalIn: Number(totalIn.toFixed(6)),
    totalOut: Number(totalOut.toFixed(6)),
    feesNative: Number(fees.toFixed(6)),
    trades,
  };
}

export async function loadWalletActivity(
  address: string,
  chain: "solana" | "evm",
  cluster: Cluster = "mainnet-beta",
  limit = 30,
): Promise<WalletActivity> {
  const symbol = chain === "solana" ? "SOL" : "ETH";
  const notes: string[] = [];

  const [result, price] = await Promise.all([
    cached(`act:${chain}:${cluster}:${address}:${limit}`, 60_000, () =>
      chain === "solana" ? solanaActivity(address, cluster, limit) : evmActivity(address, limit),
    ).catch((error: Error) => ({ txs: [] as WalletTx[], note: `Chain history unavailable: ${error.message}` })),
    spot(chain === "solana" ? "SOLUSDT" : "ETHUSDT").catch(() => 0),
  ]);

  if (result.note) notes.push(result.note);
  if (cluster === "devnet") notes.push("Devnet balances and flows carry no USD value — pricing is shown for reference only.");
  if (result.txs.length > 0)
    notes.push("P&L uses an average-cost book over native transfers valued at each transaction's daily close.");

  return {
    address,
    chain,
    cluster,
    symbol,
    txs: result.txs,
    pnl: result.txs.length > 0 ? book(result.txs, symbol, price) : null,
    notes,
    updatedAt: Date.now(),
  };
}
