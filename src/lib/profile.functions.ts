import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  displayName: z.string().min(2).max(48),
  handle: z.string().max(32).nullable(),
  bio: z.string().max(280).nullable(),
  timezone: z.string().max(64).nullable(),
  xHandle: z.string().max(32).nullable(),
  telegramHandle: z.string().max(32).nullable(),
  avatarPath: z.string().max(240).nullable(),
});

export type ProfileInput = z.infer<typeof schema>;

/** Save the signed-in member's public identity. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProfileInput) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const clean = (v: string | null) => {
      const t = v?.trim();
      return t ? t : null;
    };
    const handle = clean(data.handle);
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .update({
        display_name: data.displayName.trim(),
        handle: handle ? (handle.startsWith("@") ? handle : `@${handle}`) : null,
        bio: clean(data.bio),
        timezone: clean(data.timezone),
        x_handle: clean(data.xHandle),
        telegram_handle: clean(data.telegramHandle),
        avatar_url: clean(data.avatarPath),
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return profile;
  });

/** Short-lived signed URL for a private avatar object. */
export const getAvatarUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) => z.object({ path: z.string().min(1).max(240) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("avatars")
      .createSignedUrl(data.path, 60 * 60 * 6);
    if (error) return { url: null as string | null };
    return { url: signed.signedUrl };
  });
