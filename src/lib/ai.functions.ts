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

/** SOLIQ AI chat grounded in the live desk tape. */
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AskInput) => schema.parse(input))
  .handler(async ({ data }) => {
    const { askSoliqAi } = await import("@/lib/ai.server");
    const answer = await askSoliqAi(data.messages);
    return { answer };
  });
