import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, CreditCard, Loader2, Palette, Save, ShieldCheck, Sparkles, Upload, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/soliq/AppShell";
import { SectionTitle } from "@/components/soliq/primitives";
import { useTheme } from "@/components/soliq/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBilling, useBillingPortal } from "@/hooks/use-billing";
import { useProfile, usePushPermission } from "@/hooks/use-soliq-account";
import { supabase } from "@/integrations/supabase/client";
import { planByTier } from "@/lib/membership";
import { updateMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Profile — Avatar, Bio & Alerts | SOLIQ" },
      {
        name: "description",
        content:
          "Manage your SOLIQ identity: avatar, display name, bio, social handles, time zone, appearance and alert delivery.",
      },
      { property: "og:title", content: "Settings & Profile — SOLIQ" },
      { property: "og:description", content: "Avatar, bio, handles, appearance and alert preferences in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Settings,
});

const zones = ["UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];

function Settings() {
  const { data: profile, tier, isSignedIn, isLoading } = useProfile();
  const billing = useBilling();
  const portal = useBillingPortal();
  const queryClient = useQueryClient();
  const save = useServerFn(updateMyProfile);
  const { theme, setTheme } = useTheme();
  const push = usePushPermission();

  const [form, setForm] = useState({
    displayName: "",
    handle: "",
    bio: "",
    timezone: "UTC",
    xHandle: "",
    telegramHandle: "",
    avatarPath: "" as string,
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      displayName: profile.display_name ?? "",
      handle: profile.handle ?? "",
      bio: profile.bio ?? "",
      timezone: profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
      xHandle: profile.x_handle ?? "",
      telegramHandle: profile.telegram_handle ?? "",
      avatarPath: profile.avatar_url ?? "",
    });
  }, [profile]);

  useEffect(() => {
    let live = true;
    const path = form.avatarPath;
    if (!path) {
      setAvatarPreview(null);
      return;
    }
    supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 6)
      .then(({ data }) => {
        if (live) setAvatarPreview(data?.signedUrl ?? null);
      });
    return () => {
      live = false;
    };
  }, [form.avatarPath]);

  const initials = useMemo(
    () => (form.displayName || "SOLIQ").slice(0, 2).toUpperCase(),
    [form.displayName],
  );

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          displayName: form.displayName || "SOLIQ Member",
          handle: form.handle || null,
          bio: form.bio || null,
          timezone: form.timezone || null,
          xHandle: form.xHandle || null,
          telegramHandle: form.telegramHandle || null,
          avatarPath: form.avatarPath || null,
        },
      }),
    onSuccess: () => {
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onUpload = async (file: File) => {
    const { data: session } = await supabase.auth.getUser();
    const uid = session.user?.id;
    if (!uid) return;
    if (file.size > 3_000_000) {
      toast.error("Keep avatars under 3MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${uid}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm((f) => ({ ...f, avatarPath: path }));
    toast.success("Avatar uploaded — hit save to publish it");
  };

  if (!isSignedIn && !isLoading) {
    return (
      <AppShell>
        <div className="panel mx-auto mt-10 max-w-md p-8 text-center">
          <UserRound className="mx-auto size-8 text-primary" />
          <h1 className="mt-3 text-lg font-semibold">Sign in to manage your profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your avatar, bio, handles and alert delivery live on your SOLIQ account.
          </p>
          <Button asChild variant="hero" className="mt-4">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="flex items-center gap-2 text-xl font-bold lg:text-2xl">
        <UserRound className="size-5 text-primary" /> Settings
      </h1>
      <p className="text-sm text-muted-foreground">Your public identity, appearance and alert delivery.</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="panel p-5 lg:col-span-2">
          <SectionTitle title="Public profile" subtitle="Shown on your community posts and rankings" />

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              {avatarPreview ?
                <img src={avatarPreview} alt={`${form.displayName || "Member"} avatar`} className="size-20 rounded-2xl object-cover" />
              : <div className="grid size-20 place-items-center rounded-2xl bg-primary/15 font-display text-xl font-bold text-primary glow-ring">
                  {initials}
                </div>
              }
            </div>
            <div>
              <Label htmlFor="avatar" className="text-xs text-muted-foreground">
                Avatar
              </Label>
              <div className="mt-1 flex items-center gap-2">
                <Button asChild size="sm" variant="subtle" disabled={uploading}>
                  <label htmlFor="avatar" className="cursor-pointer">
                    {uploading ?
                      <Loader2 className="size-3.5 animate-spin" />
                    : <Upload className="size-3.5" />}
                    {uploading ? "Uploading…" : "Upload image"}
                  </label>
                </Button>
                {form.avatarPath && (
                  <Button size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, avatarPath: "" }))}>
                    Remove
                  </Button>
                )}
              </div>
              <input
                id="avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUpload(file);
                }}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">PNG, JPG, WEBP or GIF · up to 3MB</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="Nova Trader"
              />
            </div>
            <div>
              <Label htmlFor="handle">Handle</Label>
              <Input
                id="handle"
                value={form.handle}
                onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                placeholder="@novatrader"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={3}
                maxLength={280}
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Solana degen turned systematic futures trader. Flow, liquidity and mean reversion."
              />
              <p className="mt-1 text-right text-[10px] text-muted-foreground">{form.bio.length}/280</p>
            </div>
            <div>
              <Label htmlFor="x">X handle</Label>
              <Input
                id="x"
                value={form.xHandle}
                onChange={(e) => setForm((f) => ({ ...f, xHandle: e.target.value }))}
                placeholder="@soliq"
              />
            </div>
            <div>
              <Label htmlFor="tg">Telegram</Label>
              <Input
                id="tg"
                value={form.telegramHandle}
                onChange={(e) => setForm((f) => ({ ...f, telegramHandle: e.target.value }))}
                placeholder="@soliqdesk"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="tz">Time zone</Label>
              <select
                id="tz"
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Session clocks and alert timestamps follow this zone.
              </p>
            </div>
          </div>

          <Button variant="hero" className="mt-5" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ?
              <Loader2 className="size-4 animate-spin" />
            : <Save className="size-4" />}
            Save profile
          </Button>
        </section>

        <div className="space-y-5">
          <section className="panel p-5">
            <SectionTitle title="Appearance" subtitle="Terminal theme" />
            <div className="flex items-center gap-2">
              <Palette className="size-4 text-primary" />
              <div className="flex gap-2">
                {(["dark", "light"] as const).map((t) => (
                  <Button key={t} size="sm" variant={theme === t ? "hero" : "subtle"} onClick={() => setTheme(t)}>
                    {t === "dark" ? "Dark" : "Light"}
                  </Button>
                ))}
              </div>
            </div>
          </section>

          <section className="panel p-5">
            <SectionTitle title="Alerts" subtitle="Delivery for unusual activity" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <BellRing className="size-4 text-primary" /> Browser push
              </div>
              <Switch
                checked={push.enabled}
                onCheckedChange={(v) => (v ? void push.request() : push.disable())}
                disabled={push.permission === "unsupported"}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {push.permission === "unsupported"
                ? "This browser does not support notifications."
                : "Price thresholds, whale prints and unusual flow are pushed instantly."}
            </p>
            <Button asChild size="sm" variant="subtle" className="mt-3 w-full">
              <Link to="/lists">Manage alert rules</Link>
            </Button>
          </section>

          <section className="panel p-5">
            <SectionTitle title="Membership" subtitle="Access tier" />
            <p className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-primary" /> {planByTier(tier).name} plan
            </p>
            <Button asChild size="sm" variant="hero" className="mt-3 w-full">
              <Link to="/pricing">
                <Sparkles className="size-3.5" /> Manage plan
              </Link>
            </Button>
            {billing.hasBillingAccount ? (
              <Button
                size="sm"
                variant="subtle"
                className="mt-2 w-full"
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
              >
                {portal.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CreditCard className="size-3.5" />}
                Billing portal — invoices & cancel
              </Button>
            ) : null}
          </section>

          <section className="panel p-5">
            <SectionTitle title="Legal & data" subtitle="Policies" />
            <div className="grid gap-1.5 text-xs">
              <Link to="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              <Link to="/terms" hash="section-9" className="text-primary hover:underline">
                Cancellation & renewal
              </Link>
              <Link to="/terms" hash="section-10" className="text-primary hover:underline">
                Refund policy
              </Link>
              <Link to="/terms" hash="section-26" className="text-primary hover:underline">
                Security & data protection
              </Link>
            </div>
          </section>

        </div>
      </div>
    </AppShell>
  );
}
