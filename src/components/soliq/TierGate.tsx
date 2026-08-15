import { Link } from "@tanstack/react-router";
import { Crown, Lock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-soliq-account";
import { FEATURES, canUse, type FeatureKey } from "@/lib/entitlements";
import { planByTier } from "@/lib/membership";

/**
 * Client-side entitlement gate. UX only — every premium server function
 * re-checks the tier server-side.
 */
export function TierGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { tier, isSignedIn, isLoading } = useProfile();
  const required = FEATURES[feature].tier;

  if (isSignedIn && isLoading) {
    return (
      <div className="panel h-64 animate-pulse" aria-busy="true" aria-label="Checking membership" />
    );
  }
  if (canUse(feature, tier)) return <>{children}</>;

  const plan = planByTier(required);
  const isElite = required === "elite";

  return (
    <div className="panel mx-auto max-w-lg p-8 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
        {isElite ? <Crown className="size-5" /> : <Lock className="size-5" />}
      </span>
      <h2 className="font-display mt-4 text-lg font-semibold">{plan.name} feature</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {FEATURES[feature].label} is part of the {plan.name} plan.{" "}
        {isSignedIn
          ? `Upgrade for $${plan.price}/month to unlock it.`
          : "Sign in and upgrade to unlock it."}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button asChild variant="hero">
          <Link to={isSignedIn ? "/pricing" : "/auth"}>
            <Sparkles className="size-4" /> {isSignedIn ? `Upgrade to ${plan.name}` : "Sign in"}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/terminal">Back to terminal</Link>
        </Button>
      </div>
    </div>
  );
}
