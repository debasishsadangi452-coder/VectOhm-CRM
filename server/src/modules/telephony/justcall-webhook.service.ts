import { Injectable, Logger } from "@nestjs/common";
import { CallStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { logCallToDealTimeline } from "./calls.service";

// Maps JustCall's call.* webhook status strings to our CallStatus enum.
// The exact set of strings JustCall sends was NOT independently confirmed
// against a live payload -- this covers every plausible naming JustCall's
// docs/help-center excerpts referenced (e.g. "call.completed"), but must be
// checked against a real webhook delivery once the account is connected
// (JustCall's dashboard shows delivery logs with the raw payload for this).
const STATUS_MAP: Record<string, CallStatus> = {
  initiated: CallStatus.INITIATED,
  ringing: CallStatus.RINGING,
  answered: CallStatus.CONNECTED,
  connected: CallStatus.CONNECTED,
  completed: CallStatus.COMPLETED,
  failed: CallStatus.FAILED,
  busy: CallStatus.BUSY,
  no_answer: CallStatus.NO_ANSWER,
  "no-answer": CallStatus.NO_ANSWER,
};

@Injectable()
export class JustCallWebhookService {
  private readonly logger = new Logger(JustCallWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Idempotent: a redelivered event with the same provider_event_id is a
  // no-op (unique constraint on CallEvent.providerEventId), and the Call
  // upsert always keys on providerCallId, never creates a duplicate Call.
  async handleEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const providerCallId = this.extractCallId(payload);
    if (!providerCallId) {
      this.logger.warn(`JustCall webhook "${eventType}" had no recognizable call id -- payload logged, not processed`);
      return;
    }

    const providerEventId = this.extractEventId(payload);
    if (providerEventId) {
      const existingEvent = await this.prisma.callEvent.findUnique({ where: { providerEventId } });
      if (existingEvent) {
        return; // already processed this exact event
      }
    }

    let call = await this.prisma.call.findUnique({ where: { providerCallId } });

    if (!call) {
      // No CRM-created row (either the frontend's link-provider-id step
      // hasn't landed yet, or this is a genuinely inbound call with no prior
      // local row). Best-effort resolve an agent/contact so the row isn't
      // orphaned; if the agent can't be resolved, DO NOT log it as a random
      // user's call -- give up gracefully instead of guessing.
      const agentId = await this.resolveAgentId(payload);
      if (!agentId) {
        this.logger.warn(
          `JustCall webhook for unknown call ${providerCallId} could not be attributed to an agent -- skipped`,
        );
        return;
      }
      const contactId = await this.resolveContactId(payload);
      call = await this.prisma.call.create({
        data: {
          providerCallId,
          agentId,
          contactId,
          direction: this.extractDirection(payload),
          fromNumber: this.extractString(payload, ["from", "from_number", "justcall_number"]) ?? "",
          toNumber: this.extractString(payload, ["to", "to_number", "contact_number"]) ?? "",
          status: CallStatus.INITIATED,
        },
      });
    }

    const statusRaw = this.extractString(payload, ["status", "call_status"])?.toLowerCase();
    const status = statusRaw ? STATUS_MAP[statusRaw] : undefined;
    const durationSec = this.extractNumber(payload, ["duration", "call_duration"]);
    const recordingUrl = this.extractString(payload, ["recording_url", "recording"]);

    const updated = await this.prisma.call.update({
      where: { id: call.id },
      data: {
        status: status ?? undefined,
        durationSec: durationSec ?? undefined,
        recordingUrl: recordingUrl ?? undefined,
        recordingStatus: recordingUrl ? "AVAILABLE" : undefined,
        answeredAt: status === CallStatus.CONNECTED && !call.answeredAt ? new Date() : undefined,
        endedAt:
          status &&
          ([CallStatus.COMPLETED, CallStatus.FAILED, CallStatus.BUSY, CallStatus.NO_ANSWER] as CallStatus[]).includes(
            status,
          )
            ? new Date()
            : undefined,
      },
    });

    await this.prisma.callEvent.create({
      data: { callId: call.id, providerEventId, eventType, payload: payload as any },
    });

    if (status === CallStatus.COMPLETED) {
      await logCallToDealTimeline(this.prisma, {
        id: updated.id,
        dealId: updated.dealId,
        agentId: updated.agentId,
        durationSec: updated.durationSec,
        disposition: updated.disposition,
      });
    }
  }

  private extractCallId(payload: Record<string, unknown>): string | null {
    return this.extractString(payload, ["call_id", "id", "call_sid"]);
  }

  private extractEventId(payload: Record<string, unknown>): string | null {
    return this.extractString(payload, ["event_id", "webhook_id"]);
  }

  private extractDirection(payload: Record<string, unknown>): "OUTBOUND" | "INBOUND" {
    const dir = this.extractString(payload, ["direction", "call_direction"])?.toLowerCase();
    return dir === "inbound" || dir === "incoming" ? "INBOUND" : "OUTBOUND";
  }

  private extractString(payload: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
    return null;
  }

  private extractNumber(payload: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === "number") return value;
      if (typeof value === "string" && !Number.isNaN(Number(value))) return Number(value);
    }
    return null;
  }

  // Best-effort: match the webhook's agent phone/email against a User row.
  // Exact payload field names unconfirmed -- see module-level comment.
  private async resolveAgentId(payload: Record<string, unknown>): Promise<string | null> {
    const agentEmail = this.extractString(payload, ["agent_email", "user_email"]);
    if (agentEmail) {
      const user = await this.prisma.user.findUnique({ where: { email: agentEmail.toLowerCase() } });
      if (user) return user.id;
    }
    return null;
  }

  private async resolveContactId(payload: Record<string, unknown>): Promise<string | null> {
    const customerNumber = this.extractString(payload, ["contact_number", "to", "from"]);
    if (!customerNumber) return null;
    const contact = await this.prisma.contact.findFirst({ where: { phone: customerNumber } });
    return contact?.id ?? null;
  }
}
