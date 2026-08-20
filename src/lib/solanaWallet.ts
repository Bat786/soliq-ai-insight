import "@/lib/node-globals";

import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

/**
 * Client-safe Solana RPC access. The Alchemy endpoint (and its API key) lives
 * on the server; everything here goes through our same-origin proxy at
 * /api/public/solana-rpc, which forwards to
 *   devnet  → https://solana-devnet.g.alchemy.com/v2/{ALCHEMY_API_KEY}
 *   mainnet → https://solana-mainnet.g.alchemy.com/v2/{ALCHEMY_API_KEY}
 *
 * Flip networks with VITE_SOLANA_NETWORK=mainnet — no code changes.
 */
export type SolanaNetwork = "devnet" | "mainnet";

export const SOLANA_RPC_PATH = "/api/public/solana-rpc";

export const solanaNetwork: SolanaNetwork = String(import.meta.env["VITE_SOLANA_NETWORK"] ?? "devnet")
  .toLowerCase()
  .startsWith("mainnet")
  ? "mainnet"
  : "devnet";

/** Same-origin endpoint handed to web3.js / ConnectionProvider. */
export function solanaRpcEndpoint(): string {
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  return `${origin}${SOLANA_RPC_PATH}`;
}

export const solanaConnection = new Connection(solanaRpcEndpoint(), "confirmed");

/** Balance in SOL (not lamports). */
export async function getSolanaBalance(address: string, connection: Connection = solanaConnection): Promise<number> {
  const lamports = await connection.getBalance(new PublicKey(address));
  return lamports / LAMPORTS_PER_SOL;
}
