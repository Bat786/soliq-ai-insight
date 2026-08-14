import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  address: z.string().min(24).max(64),
  chain: z.enum(["solana", "evm"]),
  cluster: z.enum(["mainnet-beta", "devnet"]).default("mainnet-beta"),
});

export type WalletActivityInput = z.input<typeof schema>;

/** Public read-only chain history + P&L for one address. */
export const getWalletActivity = createServerFn({ method: "GET" })
  .inputValidator((input: WalletActivityInput) => schema.parse(input))
  .handler(async ({ data }) => {
    const { loadWalletActivity } = await import("@/lib/wallet-activity.server");
    return loadWalletActivity(data.address, data.chain, data.cluster, 30);
  });
