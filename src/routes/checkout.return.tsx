import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/soliq/AppShell";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-soliq-account";
import { syncCheckoutSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { planByTier } from "@/lib/membership";

export const Route = createFileRoute("/checkout/return")({
  // session_id comes from Stripe's server-side substitution of the placeholder.
  validateSearch: (search: Record<string, unknown>): { session_id?: string | undefined } => ({
    session_id: typeof search["session_id"] === "string" ? search["session_id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Membership confirmed — SOLIQ" },
      { name: "description", content: "Your SOLIQ membership checkout result and what unlocks next." },
      { property: "og:title", content: "Membership confirmed — SOLIQ" },
      { property: "og:description", content: "Your SOLIQ membership is being activated." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();
  const sync = useServerFn(syncCheckoutSession);
  const queryClient = useQueryClient();
  const { tier } = useProfile();
  const [state, setState] = useState<"working" | "done" | "pending">("working");
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setState("pending");
      setReason("No checkout session was found in this link.");
      return;
    }
    let cancelled = false;
    (async () => {
      // Reconcile immediately so access unlocks even if the webhook is in flight.
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        const result = await sync({ data: { sessionId, environment: getStripeEnvironment() } });
        if (cancelled) return;
        if (result.ok) {
          await queryClient.invalidateQueries({ queryKey: ["profile"] });
          await queryClient.invalidateQueries({ queryKey: ["billing"] });
          setState("done");
          return;
        }
        setReason(result.reason ?? null);
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!cancelled) setState("pending");
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, sync, queryClient]);

  return (
    <AppShell>
      <div className="panel mx-auto max-w-lg p-8 text-center">
        {state === "working" && (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <h1 className="font-display mt-4 text-lg font-semibold">Activating your membership…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Confirming the payment with our billing provider. This usually takes a few seconds.
            </p>
          </>
        )}

        {state === "done" && (
          <>
            <BadgeCheck className="mx-auto size-9 text-bull" />
            <h1 className="font-display mt-4 text-lg font-semibold">
              {planByTier(tier).name} membership active
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Unlimited alerts, whale flow and community posting are unlocked
              {tier === "elite" ? ", along with backtesting and AI deep research." : "."}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button asChild variant="hero">
                <Link to="/terminal">Open the terminal</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/pricing">Manage billing</Link>
              </Button>
            </div>
          </>
        )}

        {state === "pending" && (
          <>
            <TriangleAlert className="mx-auto size-8 text-warn" />
            <h1 className="font-display mt-4 text-lg font-semibold">Payment still processing</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {reason ?? "Your payment has not finished settling."} Your membership unlocks
              automatically as soon as the payment confirms — no action needed.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button asChild variant="hero">
                <Link to="/terminal">Back to terminal</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/pricing">Billing</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
