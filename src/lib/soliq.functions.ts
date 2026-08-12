import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fmtUsd } from "@/lib/format";
import { FREE_ALERT_LIMIT, isPaid, type Tier } from "@/lib/membership";

const RETRIGGER_MS = 60 * 60 * 1000;

/** Load (and lazily create) the signed-in member's profile. */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const existing = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) return existing.data;

    const email = typeof claims["email"] === "string" ? claims["email"] : "";
    const created = await supabase
      .from("profiles")
      .insert({
        id: userId,
        display_name: email ? email.split("@")[0]! : "SOLIQ Member",
        handle: email ? `@${email.split("@")[0]!.replace(/[^a-z0-9_]/gi, "").toLowerCase()}` : null,
      })
      .select("*")
      .single();
    if (created.error) throw new Error(created.error.message);
    return created.data;
  });

/**
 * Activates a premium membership. Billing is not wired yet — this grants the
 * plan directly so the entitlement surfaces can be used end to end.
 */
export const setMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tier: Tier }) => z.object({ tier: z.enum(["free", "pro", "elite"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const paid = isPaid(data.tier);
    const now = new Date();
    const { data: profile, error } = await supabase
      .from("profiles")
      .update({
        membership_tier: data.tier,
        member_since: paid ? now.toISOString() : null,
        renews_at: paid ? new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString() : null,
        updated_at: now.toISOString(),
      })
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return profile;
  });

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("watchlist_alerts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const createAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { listName: string; assetId: string; direction: "above" | "below"; threshold: number }) =>
    z
      .object({
        listName: z.string().min(1).max(80),
        assetId: z.string().min(1).max(40),
        direction: z.enum(["above", "below"]),
        threshold: z.number().positive().finite(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { loadUniverse } = await import("@/lib/live-market.server");
    const universe = await loadUniverse();
    const asset = universe.find((a) => a.id === data.assetId || a.symbol.toUpperCase() === data.assetId.toUpperCase());
    if (!asset) throw new Error("Unknown asset");

    const profile = await supabase.from("profiles").select("membership_tier").eq("id", userId).maybeSingle();
    const tier = (profile.data?.membership_tier ?? "free") as Tier;
    if (!isPaid(tier)) {
      const { count } = await supabase.from("watchlist_alerts").select("id", { count: "exact", head: true });
      if ((count ?? 0) >= FREE_ALERT_LIMIT) {
        return { limitReached: true as const, alert: null };
      }
    }

    const { data: alert, error } = await supabase
      .from("watchlist_alerts")
      .insert({
        user_id: userId,
        list_name: data.listName,
        asset_id: asset.id,
        asset_symbol: asset.symbol,
        direction: data.direction,
        threshold: data.threshold,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { limitReached: false as const, alert };
  });

export const setAlertActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("watchlist_alerts")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("watchlist_alerts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Compares every active alert against the current market price and files notifications. */
export const evaluateAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: alerts, error } = await supabase.from("watchlist_alerts").select("*").eq("active", true);
    if (error) throw new Error(error.message);

    const now = Date.now();
    let triggered = 0;

    const { loadUniverse } = await import("@/lib/live-market.server");
    const universe = (alerts ?? []).length ? await loadUniverse() : [];

    for (const alert of alerts ?? []) {
      const asset = universe.find((a) => a.id === alert.asset_id);
      if (!asset) continue;
      const threshold = Number(alert.threshold);
      const hit = alert.direction === "above" ? asset.price >= threshold : asset.price <= threshold;
      if (!hit) continue;
      if (alert.last_triggered_at && now - new Date(alert.last_triggered_at).getTime() < RETRIGGER_MS) continue;

      const inserted = await supabase.from("notifications").insert({
        user_id: userId,
        alert_id: alert.id,
        title: `${alert.asset_symbol} ${alert.direction === "above" ? "crossed above" : "dropped below"} ${fmtUsd(threshold)}`,
        body: `${asset.name} is trading at ${fmtUsd(asset.price)} (${asset.change24h >= 0 ? "+" : ""}${asset.change24h.toFixed(2)}% 24h). Triggered by your "${alert.list_name}" alert.`,
      });
      if (inserted.error) continue;
      await supabase
        .from("watchlist_alerts")
        .update({ last_triggered_at: new Date(now).toISOString() })
        .eq("id", alert.id);
      triggered += 1;
    }

    return { triggered };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data;
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", context.userId)
      .eq("read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createCommunityPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { body: string }) => z.object({ body: z.string().min(3).max(1000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profile = await supabase.from("profiles").select("membership_tier").eq("id", userId).maybeSingle();
    const tier = (profile.data?.membership_tier ?? "free") as Tier;
    if (!isPaid(tier)) return { needsUpgrade: true as const, post: null };

    const { data: post, error } = await supabase
      .from("community_posts")
      .insert({ user_id: userId, body: data.body.trim(), tags: ["Idea"] })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { needsUpgrade: false as const, post };
  });
