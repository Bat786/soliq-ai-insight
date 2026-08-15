import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(24),
});

export type AskInput = z.infer<typeof schema>;

/** SOLIQ AI chat grounded in the live desk tape + the member's own account state. */
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AskInput) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const [{ askSoliqAi }, { buildAccountContext }] = await Promise.all([
      import("@/lib/ai.server"),
      import("@/lib/account-context.server"),
    ]);
    // Read-only: scoped to the caller's own rows via their RLS client.
    const account = await buildAccountContext(context.supabase, context.userId).catch(() => "");
    const answer = await askSoliqAi(data.messages, account);
    return { answer };
  });

