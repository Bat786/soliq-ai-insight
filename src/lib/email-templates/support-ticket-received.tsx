import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { TemplateEntry } from "./registry";

interface SupportTicketReceivedProps {
  ticketId?: string;
  subject?: string;
  category?: string;
  message?: string;
}

export function SupportTicketReceived({
  ticketId = "00000000",
  subject = "Support request",
  category = "billing",
  message = "",
}: SupportTicketReceivedProps) {
  return (
    <Html>
      <Head />
      <Preview>{`We received your SOLIQ support request (${ticketId})`}</Preview>
      <Body style={{ backgroundColor: "#0b1120", fontFamily: "Helvetica, Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "32px 24px" }}>
          <Text style={{ color: "#6ee7b7", fontSize: "12px", letterSpacing: "2px", margin: 0 }}>
            SOLIQ INTELLIGENCE
          </Text>
          <Heading style={{ color: "#f8fafc", fontSize: "22px", margin: "8px 0 16px" }}>
            We&apos;ve got your request
          </Heading>
          <Text style={{ color: "#cbd5e1", fontSize: "14px", lineHeight: "22px" }}>
            Thanks for reaching out. Our team reviews tickets in the order they arrive and usually replies within one
            business day.
          </Text>
          <Section
            style={{
              backgroundColor: "#111c33",
              borderRadius: "10px",
              padding: "16px",
              margin: "20px 0",
            }}
          >
            <Text style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 4px" }}>Ticket</Text>
            <Text style={{ color: "#f8fafc", fontSize: "14px", margin: "0 0 12px" }}>{ticketId}</Text>
            <Text style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 4px" }}>Subject</Text>
            <Text style={{ color: "#f8fafc", fontSize: "14px", margin: "0 0 12px" }}>{subject}</Text>
            <Text style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 4px" }}>Category</Text>
            <Text style={{ color: "#f8fafc", fontSize: "14px", margin: 0 }}>{category}</Text>
            {message ? (
              <>
                <Hr style={{ borderColor: "#1e293b", margin: "14px 0" }} />
                <Text style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: "20px", margin: 0 }}>{message}</Text>
              </>
            ) : null}
          </Section>
          <Text style={{ color: "#64748b", fontSize: "12px", lineHeight: "18px" }}>
            You can manage your plan and payment method any time from Support → Manage billing.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: SupportTicketReceived,
  displayName: "Support ticket received",
  subject: (data) => `We received your request — ${String(data["subject"] ?? "SOLIQ support")}`,
  previewData: {
    ticketId: "8f21c4de",
    subject: "Charged twice for Pro",
    category: "billing",
    message: "I was billed twice on Aug 14 for the Pro plan and would like one charge refunded.",
  },
} satisfies TemplateEntry;
