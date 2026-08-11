import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Check, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/soliq/AppShell";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-soliq-account";
import { plans, type Tier } from "@/lib/membership";
import { setMembership } from "@/lib/soliq.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "SOLIQ Access — Pro $20 & Elite $30 Plans" },
      {
        name: "description",
        content:
          "Unlock the AETHRON engine: unlimited real-time alerts, whale flow, community posting and AI deep research from $20/month.",
      },
      { property: "og:title", content: "SOLIQ Access — Pro & Elite" },
      {
        property: "og:description",
        content: "Unlimited alerts, whale flow, verified badge and AI deep research from $20/month.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pricing,
});


function Pricing() {
  const { tier, isSignedIn } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const changePlan = useServerFn(setMembership);

  const mutation = useMutation({
    mutationFn: (next: Tier) => changePlan({ data: { tier: next } }),
    onSuccess: (profile) => {
      queryClient.setQueryData(["profile"], profile);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(
        profile.membership_tier === "free"
          ? "Membership cancelled — you're back on Orbit."
          : `${profile.membership_tier === "elite" ? "Elite" : "Pro"} membership active.`,
      );
    },
    onError: () => toast.error("Could not update your membership. Please try again."),
  });

  const choose = (next: Tier) => {
    if (!isSignedIn) {
      navigate({ to: "/auth" });
      return;
    }
    mutation.mutate(next);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] text-primary">
            <Sparkles className="size-3.5" /> SOLIQ Access
          </span>
          <h1 className="font-display mt-4 text-2xl font-bold lg:text-3xl">
            Run the engine at <span className="text-gradient">full power</span>
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Pro and Elite unlock unlimited real-time alerts, institutional whale flow, posting rights in the community
            terminal — which keeps spam and bots out — and a verified badge next to your name.
          </p>

        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const current = plan.tier === tier;
            return (
              <div
                key={plan.tier}
                className={`panel flex flex-col p-6 ${plan.tier === "pro" ? "border-primary/40 glow-ring" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold">{plan.name}</h2>
                  {plan.badge && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary">
                      {plan.tier === "elite" ? <Crown className="size-3" /> : <BadgeCheck className="size-3" />}
                      {plan.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{plan.tagline}</p>
                <p className="num mt-4 text-3xl font-bold">
                  ${plan.price}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/{plan.cadence}</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-bull" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={current ? "subtle" : plan.tier === "free" ? "outline" : "hero"}
                  disabled={current || mutation.isPending}
                  onClick={() => choose(plan.tier)}
                >
                  {current
                    ? "Current plan"
                    : plan.tier === "free"
                      ? "Cancel membership"
                      : `Upgrade to ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Card billing is not connected yet — memberships activate instantly in this preview. Want live Stripe checkout?
          Ask and I'll wire it up.{" "}
          <Link to="/community" className="text-primary">
            See member perks in the community →
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
