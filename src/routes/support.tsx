import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CreditCard, ExternalLink, HelpCircle, LifeBuoy, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/soliq/AppShell";
import { SectionTitle } from "@/components/soliq/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBilling, useBillingPortal } from "@/hooks/use-billing";
import { useSession } from "@/hooks/use-soliq-account";
import {
  SUPPORT_CATEGORIES,
  listMySupportTickets,
  submitSupportTicket,
  type SupportCategory,
} from "@/lib/support.functions";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "SOLIQ Support — Billing, Payments & Account Help" },
      {
        name: "description",
        content:
          "Get help with SOLIQ billing, subscriptions, payment methods, wallet, brokerage and bank connections. Open a support ticket or manage your plan self-serve.",
      },
      { property: "og:title", content: "SOLIQ Support — Billing & Account Help" },
      {
        property: "og:description",
        content: "Open a ticket, read billing FAQs, or manage your subscription and payment method self-serve.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://soliqintel.com/support" }],
  }),
  component: Support,
});

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  billing: "Billing & subscription",
  payments: "Payments & refunds",
  account: "Account & login",
  connections: "Wallet / brokerage / bank",
  technical: "Technical issue",
  other: "Something else",
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I upgrade, downgrade or cancel my plan?",
    a: "Upgrades start on the Pricing page — checkout is handled by Stripe and your membership unlocks the moment the payment is confirmed. To cancel or switch cards, open Manage billing below (the Stripe Customer Portal). Cancelling keeps your access until the end of the period you already paid for, then drops you to Orbit (free).",
  },
  {
    q: "How do I update my payment method?",
    a: "Manage billing → Payment methods. The portal is hosted by Stripe, so SOLIQ never sees or stores your card details.",
  },
  {
    q: "My payment failed — did I lose access?",
    a: "No. If a charge fails, Stripe retries automatically and your access stays on while it does, with a banner prompting you to fix the card. If every retry fails the subscription cancels and you return to Orbit.",
  },
  {
    q: "What is your refund policy?",
    a: "Placeholder pending final policy: subscriptions are billed in advance and cancellation stops future renewals rather than refunding the current period. If you were charged in error, open a Payments & refunds ticket below with the date and amount and we will review it.",
  },
  {
    q: "Why does my invoice say a different name?",
    a: "Card statements for SOLIQ subscriptions can show the payment processor's descriptor alongside SOLIQ. It is the same charge.",
  },
  {
    q: "How do wallet connections work (Solana / EVM)?",
    a: "Read-only. Connecting Phantom, Solflare or MetaMask only shares your public address so SOLIQ can read balances and transaction history on-chain. SOLIQ never requests transfer approval, never holds keys, and cannot move funds. Disconnect any time from the header button or the Wallets page.",
  },
  {
    q: "How does the brokerage connection work?",
    a: "Brokerage linking runs through SnapTrade's connection portal in read-only mode: balances, positions, cost basis and trade history sync into SOLIQ. If a connection breaks (broker password change or expired consent) the Brokerage page shows a Reconnect button.",
  },
  {
    q: "How does bank linking work?",
    a: "Bank and cash accounts link through Plaid. Access tokens are stored server-side only and are never exposed to the browser; SOLIQ reads balances for your net-worth view and cannot initiate payments.",
  },
  {
    q: "Can SOLIQ AI change my billing?",
    a: "No. The assistant can read your plan and connection status to explain what is happening and point you to the right page, but it cannot charge, cancel, refund or edit anything.",
  },
];

function Support() {
  const { isSignedIn } = useSession();
  const billing = useBilling();
  const portal = useBillingPortal();
  const queryClient = useQueryClient();

  const submit = useServerFn(submitSupportTicket);
  const fetchTickets = useServerFn(listMySupportTickets);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportCategory>("billing");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  const tickets = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => fetchTickets(),
    enabled: isSignedIn,
  });

  const mutation = useMutation({
    mutationFn: () => submit({ data: { subject, category, message } }),
    onSuccess: (row) => {
      setSent(row.id);
      setSubject("");
      setMessage("");
      toast.success("Support ticket received", {
        description: "We have your request on record and will reply by email.",
      });
      void queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (e: Error) =>
      toast.error("Could not send your ticket", { description: e.message || "Please try again." }),
  });

  const canSend = subject.trim().length >= 4 && message.trim().length >= 10 && !mutation.isPending;

  return (
    <AppShell>
      <div className="space-y-6">
        <SectionTitle
          as="h1"
          title="Support & help centre"
          subtitle="Billing, payments, account access and connection troubleshooting — answered here or by ticket."

          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => portal.mutate()}
              disabled={!isSignedIn || !billing.configured || !billing.hasBillingAccount || portal.isPending}
              title={
                billing.hasBillingAccount
                  ? "Opens the Stripe Customer Portal in a new tab"
                  : "Available once you have an active subscription"
              }
            >
              {portal.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CreditCard className="size-3.5" />}
              Manage billing
              <ExternalLink className="size-3 opacity-60" />
            </Button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Ticket form */}
          <section className="glass rounded-xl border border-border/60 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <LifeBuoy className="size-4 text-primary" /> Open a support ticket
            </h2>

            {!isSignedIn ? (
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p>Sign in so we can attach the ticket to your account and reply to the right inbox.</p>
                <Button asChild size="sm">
                  <Link to="/auth">Sign in to contact support</Link>
                </Button>
              </div>
            ) : (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canSend) mutation.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="support-subject">
                    Subject
                  </label>
                  <Input
                    id="support-subject"
                    value={subject}
                    maxLength={140}
                    placeholder="Charged twice for Pro"
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="support-category">
                    Category
                  </label>
                  <select
                    id="support-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SupportCategory)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {SUPPORT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="support-message">
                    What happened?
                  </label>
                  <Textarea
                    id="support-message"
                    value={message}
                    rows={6}
                    maxLength={4000}
                    placeholder="Include dates, amounts and the page you were on so we can trace it quickly."
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                <Button type="submit" disabled={!canSend} className="w-full sm:w-auto">
                  {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Send to support
                </Button>

                {sent ? (
                  <p className="flex items-start gap-2 rounded-md border border-bull/40 bg-bull/10 p-3 text-xs text-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-bull" />
                    <span>
                      Ticket <span className="num">{sent.slice(0, 8)}</span> logged. We reply to the email on your
                      account — usually within one business day.
                    </span>
                  </p>
                ) : null}
              </form>
            )}

            {isSignedIn && (tickets.data?.length ?? 0) > 0 ? (
              <div className="mt-5 border-t border-border/60 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your tickets</h3>
                <ul className="mt-2 space-y-2">
                  {tickets.data!.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate">{t.subject}</span>
                      <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {t.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {/* FAQ */}
          <section className="glass rounded-xl border border-border/60 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <HelpCircle className="size-4 text-primary" /> Billing & connections FAQ
            </h2>
            <div className="mt-3 divide-y divide-border/50">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-3">
                  <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                    <span className="inline-flex w-full items-center justify-between gap-3">
                      {item.q}
                      <span className="text-muted-foreground transition group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="subtle">
                <Link to="/pricing">Plans & upgrade</Link>
              </Button>
              <Button asChild size="sm" variant="subtle">
                <Link to="/assistant">Ask SOLIQ AI</Link>
              </Button>
              <Button asChild size="sm" variant="subtle">
                <Link to="/status">Feed status</Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
