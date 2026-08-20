/**
 * Server-only Solana RPC config. The Alchemy API key never leaves this module —
 * the browser talks to our own /api/public/solana-rpc proxy instead.
 */
export type SolanaNetwork = "devnet";

export function solanaNetwork(): SolanaNetwork {
  return "devnet";
}

/** Full Alchemy RPC URL (contains the secret key — server use only). */
export function alchemyRpcUrl(network: SolanaNetwork = solanaNetwork()): string {
  const key = process.env["ALCHEMY_API_KEY"];
  if (!key) throw new Error("ALCHEMY_API_KEY is not configured");
  return `https://solana-${network}.g.alchemy.com/v2/${key}`;
}
