import { createFileRoute } from "@tanstack/react-router";

import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

/**
 * Stripe webhook. Public by design (Stripe sends no session token) — security
 * comes from verifying the signature on every request before any write.
 */
async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const { upsertSubscriptionRecord, markSubscriptionCanceled } = await import(
    "@/lib/subscriptions.server"
  );

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscriptionRecord(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await markSubscriptionCanceled(event.data.object, env);
      break;
    case "checkout.session.completed": {
      // Delayed-notification methods stay "unpaid" until settlement; both
      // "paid" and "no_payment_required" are final.
      const session = event.data.object;
      if (session.payment_status !== "unpaid" && session.subscription) {
        const { createStripeClient } = await import("@/lib/stripe.server");
        const stripe = createStripeClient(env);
        const subId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId, {
          expand: ["items.data.price"],
        });
        await upsertSubscriptionRecord(sub as any, env, session.metadata?.userId);
      }
      break;
    }
    case "invoice.paid": {
      // Renewal settled — refresh the period window from the subscription.
      const invoice = event.data.object;
      const subRef = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
      if (subRef) {
        const { createStripeClient } = await import("@/lib/stripe.server");
        const stripe = createStripeClient(env);
        const subId = typeof subRef === "string" ? subRef : subRef.id;
        const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
        await upsertSubscriptionRecord(sub as any, env);
      }
      break;
    }
    default:
      console.log("Unhandled payment event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid env parameter:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv as StripeEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
