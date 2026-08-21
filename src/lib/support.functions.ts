import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SUPPORT_CATEGORIES = ["billing", "payments", "account", "connections", "technical", "other"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

const ticketSchema = z.object({
  subject: z.string().trim().min(4).max(140),
  category: z.enum(SUPPORT_CATEGORIES),
  message: z.string().trim().min(10).max(4000),
});

export type SupportTicketInput = z.infer<typeof ticketSchema>;

/** Record a support request for the signed-in member (owner-scoped by RLS). */
export const submitSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SupportTicketInput) => ticketSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = typeof claims["email"] === "string" ? claims["email"] : null;
    const { data: row, error } = await supabase
      .from("support_tickets")
      .insert({
        // Ownership comes from the validated bearer token, never from input.
        user_id: userId,
        subject: data.subject,
        category: data.category,
        message: data.message,
        contact_email: email,
      })
      .select("id, subject, category, status, created_at")
      .single();
    if (error) throw new Error(error.message);

    if (email) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        await sendTemplateEmail("support-ticket-received", email, {
          templateData: {
            ticketId: row.id.slice(0, 8),
            subject: data.subject,
            category: data.category,
            message: data.message,
          },
          idempotencyKey: `support-ticket-received-${row.id}`,
        });
      } catch (e) {
        // Never fail the ticket because the acknowledgement email could not go out.
        console.error("support ticket email failed", e);
      }
    }

    return row;
  });

/** The member's own ticket history. */
export const listMySupportTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("support_tickets")
      .select("id, subject, category, status, message, created_at")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
