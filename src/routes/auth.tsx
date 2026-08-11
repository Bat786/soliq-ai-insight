import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Apple, Check, Chrome, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/soliq/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-soliq-account";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or explore free — SOLIQ" },
      {
        name: "description",
        content: "Create a SOLIQ account to sync watchlists, alerts, portfolios and AI research — or explore as a guest.",
      },
      { property: "og:title", content: "Sign in to SOLIQ" },
      { property: "og:description", content: "Sync watchlists, alerts, portfolios and AI research across devices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Auth,
});

function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const { isSignedIn } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn) navigate({ to: "/", replace: true });
  }, [isSignedIn, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setAwaitingConfirm(true);
          toast.success("Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back to SOLIQ.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) {
      setBusy(false);
      toast.error("Could not start sign-in. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="hero-bg relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -top-32 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 size-[420px] rounded-full bg-glow/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo />
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
            <Sparkles className="size-3" /> 12,480 traders joined this month
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
            {mode === "signup" ? (
              <>
                Trade with the <span className="text-gradient">edge</span>
              </>
            ) : (
              <>
                Welcome back to <span className="text-gradient">SOLIQ</span>
              </>
            )}
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Live Solana-native intelligence: AI conviction scores, whale flow, unusual activity alerts and pro charting —
            free to start.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            {["Live on-chain flow", "AI price targets", "Real-time alerts", "Pro candles & signals"].map((f) => (
              <span key={f} className="flex items-center gap-1">
                <Check className="size-3 text-bull" /> {f}
              </span>
            ))}
          </div>
        </div>

        <div className="panel mt-6 p-6">

          <div className="flex rounded-lg border border-border bg-surface-2/50 p-1">
            {(["signup", "signin"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setAwaitingConfirm(false);
                }}
                className={`flex-1 rounded-md px-3 py-2 text-sm transition-colors ${
                  mode === m ? "bg-primary/15 text-primary" : "text-muted-foreground"
                }`}
              >
                {m === "signup" ? "Create account" : "Sign in"}
              </button>
            ))}
          </div>

          {awaitingConfirm ? (
            <div className="mt-6 space-y-3 text-center">
              <p className="text-sm font-medium">Confirm your email</p>
              <p className="text-xs text-muted-foreground">
                We sent a confirmation link to <span className="text-foreground">{email}</span>. Open it to activate your
                SOLIQ account.
              </p>
              <Button variant="subtle" className="w-full" onClick={() => setAwaitingConfirm(false)}>
                Back
              </Button>
            </div>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={submit}>
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Display name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="bg-surface-2/40"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="bg-surface-2/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-surface-2/40"
                />
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                <Mail className="size-4" /> {mode === "signup" ? "Create free account" : "Sign in"}
              </Button>
            </form>
          )}

          <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or continue with <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="subtle" disabled={busy} onClick={() => oauth("google")}>
              <Chrome className="size-4" /> Google
            </Button>
            <Button variant="subtle" disabled={busy} onClick={() => oauth("apple")}>
              <Apple className="size-4" /> Apple
            </Button>
          </div>

          <Button asChild variant="ghost" className="mt-4 w-full text-primary">
            <Link to="/">Explore AETHRON Free →</Link>
          </Button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Your watchlists, alerts and portfolio sync securely.
          </p>
        </div>
      </div>
    </div>
  );
}
