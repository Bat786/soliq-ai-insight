import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, Check, CreditCard, Crown, ExternalLink, Sparkles, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/soliq/AppShell";
import { PaymentTestModeBanner } from "@/components/payments/PaymentTestModeBanner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProfile } from "@/hooks/use-soliq-account";
import { useBilling, useBillingPortal } from "@/hooks/use-billing";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { plans, planByTier, isPaid, type Tier } from "@/lib/membership";
import { YEARLY_PRICE, priceIdFor, TIER_RANK, type Cadence } from "@/lib/entitlements";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "SOLIQ Access — Pro $20 & Elite $30 Plans" },
      {
        name: "description",
        content:
          "Unlock the AETHRON engine: unlimited real-time alerts, whale flow, community posting and AI deep research from $20/month. Cancel anytime.",
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

const dateFmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

function Pricing() {
  const { tier, isSignedIn } = useProfile();
  const navigate = useNavigate();
  const billing = useBilling();
  const portal = useBillingPortal();
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const [cadence, setCadence] = useState<Cadence>("monthly");

  const choose = (next: Tier) => {
    if (!isSignedIn) {
      navigate({ to: "/auth" });
      return;
    }
    const priceId = priceIdFor(next, cadence);
    if (!priceId) return;
    openCheckout({
      priceId,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  const priceFor = (plan: (typeof plans)[number]) => {
    if (plan.tier === "free") return { amount: 0, unit: "forever" };
    if (cadence === "yearly") {
      return { amount: YEARLY_PRICE[plan.tier as "pro" | "elite"], unit: "per year" };
    }
    return { amount: plan.price, unit: "per month" };
  };

  return (
    <AppShell>
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] text-primary">
            <Sparkles className="size-3.5" /> SOLIQ Access
          </span>
          <h1 className="font-display mt-4 text-2xl font-bold lg:text-3xl">
            Run the engine at <span className="text-gradient">full power</span>
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Pro and Elite unlock unlimited real-time alerts, institutional whale flow, posting rights in the
            community terminal and the full AETHRON research stack. Cancel anytime — access runs to the end of
            the period you paid for.
          </p>

          <div
            role="group"
            aria-label="Billing period"
            className="mt-6 inline-flex rounded-lg border border-border bg-surface-2/60 p-1 text-xs"
          >
            {(["monthly", "yearly"] as Cadence[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cadence === c}
                onClick={() => setCadence(c)}
                className={`rounded-md px-3 py-1.5 font-medium capitalize transition ${
                  cadence === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c === "yearly" ? "Yearly · save 20%" : "Monthly"}
              </button>
            ))}
          </div>
        </div>

        {billing.pastDue && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/40 bg-warn/10 p-4">
            <p className="flex items-center gap-2 text-xs text-warn">
              <TriangleAlert className="size-4 shrink-0" />
              Your last payment failed. You still have full access while we retry — update your card to keep it.
            </p>
            <Button size="sm" variant="subtle" onClick={() => portal.mutate()} disabled={portal.isPending}>
              Update payment method
            </Button>
          </div>
        )}

        {billing.active && (
          <div className="panel mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <BadgeCheck className="size-4 text-bull" />
                {planByTier(billing.tier).name} membership · {billing.cadence === "yearly" ? "yearly" : "monthly"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {billing.cancelAtPeriodEnd
                  ? `Cancelled — access ends ${dateFmt(billing.renewsAt)}.`
                  : `Renews ${dateFmt(billing.renewsAt)}.`}{" "}
                Status: {billing.active.status}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => portal.mutate()} disabled={portal.isPending}>
              <CreditCard className="size-4" /> Manage billing
              <ExternalLink className="size-3.5 opacity-60" />
            </Button>
          </div>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const current = plan.tier === tier;
            const price = priceFor(plan);
            const isDowngrade = TIER_RANK[plan.tier] < TIER_RANK[tier];
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
                  ${price.amount}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/{price.unit}</span>
                </p>
                {plan.tier !== "free" && cadence === "yearly" && (
                  <p className="mt-1 text-[11px] text-bull">
                    ${(YEARLY_PRICE[plan.tier as "pro" | "elite"] / 12).toFixed(0)}/mo equivalent
                  </p>
                )}
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-bull" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                {plan.tier === "free" ? (
                  <Button
                    className="mt-6 w-full"
                    variant={current ? "subtle" : "outline"}
                    disabled={current}
                    onClick={() => portal.mutate()}
                  >
                    {current ? "Current plan" : "Cancel via billing portal"}
                  </Button>
                ) : (
                  <Button
                    className="mt-6 w-full"
                    variant={current ? "subtle" : "hero"}
                    disabled={current}
                    onClick={() => (isDowngrade ? portal.mutate() : choose(plan.tier))}
                  >
                    {current
                      ? "Current plan"
                      : isDowngrade
                        ? `Switch to ${plan.name}`
                        : isPaid(tier)
                          ? `Upgrade to ${plan.name}`
                          : `Get ${plan.name}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {billing.rows.length > 0 && (
          <div className="panel mt-8 p-5">
            <h2 className="font-display text-sm font-semibold">Billing history</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-normal">Plan</th>
                    <th className="pb-2 font-normal">Status</th>
                    <th className="pb-2 font-normal">Period start</th>
                    <th className="pb-2 font-normal">Period end</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {billing.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2">{row.price_id}</td>
                      <td className="py-2 capitalize">
                        {row.status}
                        {row.cancel_at_period_end ? " · ending" : ""}
                      </td>
                      <td className="num py-2 text-muted-foreground">{dateFmt(row.current_period_start)}</td>
                      <td className="num py-2 text-muted-foreground">{dateFmt(row.current_period_end)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Invoices, receipts and payment methods live in the billing portal.
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Payments, tax and receipts are handled by our payment provider — SOLIQ never sees your card details.{" "}
          <Link to="/community" className="text-primary">
            See member perks in the community →
          </Link>
        </p>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => !open && closeCheckout()}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Complete your membership</DialogTitle>
          </DialogHeader>
          {checkoutElement}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
