import { createServerFn } from "@tanstack/react-start";

export const getStablecoinDesk = createServerFn({ method: "GET" }).handler(async () => {
  const { loadStablecoinDesk } = await import("@/lib/stablecoins.server");
  return loadStablecoinDesk();
});

export const getStablecoinBalances = createServerFn({ method: "GET" })
  .inputValidator((input: { owner: string }) => ({ owner: String(input?.owner ?? "").slice(0, 64) }))
  .handler(async ({ data }) => {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(data.owner)) {
      return { network: "devnet", balances: [] as { symbol: string; mint: string; amount: number; accounts: number }[] };
    }
    const { loadStablecoinBalances } = await import("@/lib/stablecoins.server");
    return loadStablecoinBalances(data.owner);
  });
