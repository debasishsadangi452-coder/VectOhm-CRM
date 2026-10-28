import { Logger } from "@nestjs/common";

// Provider-agnostic transactional email. Uses whichever key is configured:
//   RESEND_API_KEY   -> Resend  (https://resend.com)
//   SENDGRID_API_KEY -> SendGrid (https://sendgrid.com)
// If neither is set, the email is only logged (dev fallback) so flows still
// work locally without an email provider. MAIL_FROM must be a verified sender
// for the chosen provider (e.g. "Venus CRM <noreply@yourdomain.com>").
//
// Native fetch only -- no new dependency (backend runs Node 18+).

const logger = new Logger("Mailer");

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  // Set when sending on someone's behalf through the shared provider (e.g.
  // the Bulk Email/Sequence engines' HTTP fallback -- see
  // EmailConnectionsService.requireSendable) so replies still land with the
  // actual salesperson instead of the shared From address.
  replyTo?: string;
}

function fromAddress(): string {
  return process.env.MAIL_FROM || "Venus CRM <onboarding@resend.dev>";
}

// True once a shared HTTP-based sender is configured -- used as a stopgap by
// the outbound-email engines on hosts (like this app's current Railway
// deployment) that block raw SMTP egress entirely, so campaigns/sequences
// aren't hard-blocked on every user successfully connecting their own SMTP
// mailbox, which can never happen while that block is in place.
export function hasHttpMailProvider(): boolean {
  return Boolean(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY);
}

export interface SendResult {
  delivered: boolean;
  provider: string;
  // The provider's own explanation when it refused the message.
  error?: string;
}

// One readable reason for callers that record why a send failed (campaign
// recipients, sequences, automations), instead of just the provider name.
export function sendFailureMessage(result: SendResult): string {
  const detail = result.error ? `: ${result.error}` : "";
  return `Stopgap HTTP sender failed (${result.provider})${detail}`;
}

// Resend/SendGrid return JSON like {"message": "..."} -- show just the message.
function providerError(status: number, body: string): string {
  let message = body;
  try {
    const parsed = JSON.parse(body) as { message?: string; errors?: Array<{ message?: string }> };
    message = parsed.message ?? parsed.errors?.[0]?.message ?? body;
  } catch {
    // not JSON -- keep the raw text
  }
  return `${status} ${message}`.trim();
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const resendKey = process.env.RESEND_API_KEY;
  const sendgridKey = process.env.SENDGRID_API_KEY;

  try {
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAddress(),
          to: msg.to,
          subject: msg.subject,
          html: msg.html,
          reply_to: msg.replyTo,
        }),
      });
      if (!res.ok) {
        const body = await safeBody(res);
        logger.error(`Resend send failed (${res.status}): ${body}`);
        return { delivered: false, provider: "resend", error: providerError(res.status, body) };
      }
      return { delivered: true, provider: "resend" };
    }

    if (sendgridKey) {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${sendgridKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: msg.to }] }],
          from: parseFrom(fromAddress()),
          reply_to: msg.replyTo ? { email: msg.replyTo } : undefined,
          subject: msg.subject,
          content: [{ type: "text/html", value: msg.html }],
        }),
      });
      if (!res.ok) {
        const body = await safeBody(res);
        logger.error(`SendGrid send failed (${res.status}): ${body}`);
        return { delivered: false, provider: "sendgrid", error: providerError(res.status, body) };
      }
      return { delivered: true, provider: "sendgrid" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Email send threw: ${message}`);
    return { delivered: false, provider: "error", error: message };
  }

  // No provider configured -- dev fallback: log so the flow is still usable.
  logger.warn(
    `No email provider configured (set RESEND_API_KEY or SENDGRID_API_KEY). ` +
      `Would have sent to ${msg.to}: "${msg.subject}"\n${msg.text ?? stripHtml(msg.html)}`,
  );
  return { delivered: false, provider: "none", error: "No email provider is configured (set RESEND_API_KEY or SENDGRID_API_KEY)" };
}

// SendGrid wants { email, name } for the from address.
function parseFrom(from: string): { email: string; name?: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (match) {
    return { name: match[1] || undefined, email: match[2] };
  }
  return { email: from.trim() };
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return res.statusText;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
