/**
 * Server-only Solana RPC config. The Alchemy API key never leaves this module —
 * the browser talks to our own /api/public/solana-rpc proxy instead.
 */
export type SolanaNetwork = "devnet" | "mainnet";

export function solanaNetwork(): SolanaNetwork {
  const raw = (process.env["VITE_SOLANA_NETWORK"] ?? process.env["SOLANA_NETWORK"] ?? "devnet").toLowerCase();
  return raw.startsWith("mainnet") ? "mainnet" : "devnet";
}

/** Full Alchemy RPC URL (contains the secret key — server use only). */
export function alchemyRpcUrl(network: SolanaNetwork = solanaNetwork()): string {
  const key = process.env["ALCHEMY_API_KEY"];
  if (!key) throw new Error("ALCHEMY_API_KEY is not configured");
  const host = network === "mainnet" ? "solana-mainnet.g.alchemy.com" : "solana-devnet.g.alchemy.com";
  return `https://${host}/v2/${key}`;
}
