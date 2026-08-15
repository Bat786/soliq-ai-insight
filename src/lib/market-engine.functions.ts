import { createServerFn } from "@tanstack/react-start";

/** Solana memecoin momentum board (live DEX pairs, envelope-wrapped). */
export const getMemecoinMomentum = createServerFn({ method: "GET" })
  .inputValidator((input: { limit?: number }) => ({ limit: Math.min(100, Math.max(5, Number(input?.limit) || 40)) }))
  .handler(async ({ data }) => {
    const { memecoinMomentum } = await import("@/engines/market/memecoins.server");
    return memecoinMomentum(data.limit);
  });

/** Launch-stage token discovery (Pump.fun, falling back to newest DEX pairs). */
export const getNewTokens = createServerFn({ method: "GET" })
  .inputValidator((input: { limit?: number }) => ({ limit: Math.min(100, Math.max(5, Number(input?.limit) || 30)) }))
  .handler(async ({ data }) => {
    const { newTokenDiscovery } = await import("@/engines/market/memecoins.server");
    return newTokenDiscovery(data.limit);
  });
