import { createFileRoute, Link } from "@tanstack/react-router";
import { Apple, Chrome, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/soliq/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or explore free — SOLIQ" },
      {
        name: "description",
        content: "Create a SOLIQ account to sync watchlists, portfolios and AI research — or explore free as a guest.",
      },
      { property: "og:title", content: "Sign in to SOLIQ" },
      { property: "og:description", content: "Sync watchlists, portfolios and AI research across devices." },
    ],
  }),
  component: Auth,
});

function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");

  return (
    <div className="hero-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="panel mt-6 p-6">
          <div className="flex rounded-lg border border-border bg-surface-2/50 p-1">
            {(["signup", "signin"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-md px-3 py-2 text-sm transition-colors ${
                  mode === m ? "bg-primary/15 text-primary" : "text-muted-foreground"
                }`}
              >
                {m === "signup" ? "Create account" : "Sign in"}
              </button>
            ))}
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" placeholder="Alex Morgan" className="bg-surface-2/40" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@email.com" className="bg-surface-2/40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" className="bg-surface-2/40" />
            </div>
            <Button type="submit" variant="hero" className="w-full">
              <Mail className="size-4" /> {mode === "signup" ? "Create free account" : "Sign in"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or continue with <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="subtle">
              <Chrome className="size-4" /> Google
            </Button>
            <Button variant="subtle">
              <Apple className="size-4" /> Apple
            </Button>
          </div>

          <Button asChild variant="ghost" className="mt-4 w-full text-primary">
            <Link to="/">Explore SOLIQ Free →</Link>
          </Button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Demo preview — accounts activate once Cloud is connected.
          </p>
        </div>
      </div>
    </div>
  );
}
