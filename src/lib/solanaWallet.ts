import "@/lib/node-globals";

import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

/**
 * Client-safe Solana RPC access. The Alchemy endpoint (and its API key) lives
 * on the server; everything here goes through our same-origin proxy at
 * /api/public/solana-rpc, which forwards to Alchemy devnet. Mainnet stays
 * disabled for this test build.
 */
export type SolanaNetwork = "devnet";

export const SOLANA_RPC_PATH = "/api/public/solana-rpc";

export const solanaNetwork: SolanaNetwork = "devnet";

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
