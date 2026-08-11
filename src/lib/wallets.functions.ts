import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const linkSchema = z.object({
  chain: z.enum(["solana", "evm"]),
  provider: z.string().min(1).max(40),
  address: z.string().min(24).max(64),
  label: z.string().max(60).optional(),
});

export type LinkWalletInput = z.infer<typeof linkSchema>;

export const listWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("linked_wallets")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  });

export const linkWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: LinkWalletInput) => linkSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const existing = await supabase.from("linked_wallets").select("id").eq("user_id", userId);
    if (existing.error) throw new Error(existing.error.message);

    const { data: row, error } = await supabase
      .from("linked_wallets")
      .upsert(
        {
          user_id: userId,
          chain: data.chain,
          provider: data.provider,
          address: data.address,
          label: data.label ?? null,
          is_primary: (existing.data?.length ?? 0) === 0,
        },
        { onConflict: "user_id,chain,address" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const unlinkWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("linked_wallets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPrimaryWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cleared = await supabase.from("linked_wallets").update({ is_primary: false }).eq("user_id", userId);
    if (cleared.error) throw new Error(cleared.error.message);
    const { error } = await supabase.from("linked_wallets").update({ is_primary: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Live native balances + USD value for the member's linked wallets. */
export const walletBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("linked_wallets").select("address, chain");
    if (error) throw new Error(error.message);
    const { loadWalletBalances } = await import("@/lib/wallets.server");
    return loadWalletBalances((data ?? []) as { address: string; chain: "solana" | "evm" }[]);
  });
