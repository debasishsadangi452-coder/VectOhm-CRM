import { Injectable, Logger } from "@nestjs/common";
import { CallStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { logCallToDealTimeline } from "./calls.service";

const STATUS_MAP: Record<string, CallStatus> = {
  initiated: CallStatus.INITIATED,
  started: CallStatus.INITIATED,
  ringing: CallStatus.RINGING,
  answered: CallStatus.CONNECTED,
  connected: CallStatus.CONNECTED,
  ended: CallStatus.COMPLETED,
  finished: CallStatus.COMPLETED,
  completed: CallStatus.COMPLETED,
  failed: CallStatus.FAILED,
  busy: CallStatus.BUSY,
  missed: CallStatus.NO_ANSWER,
  no_answer: CallStatus.NO_ANSWER,
  "no-answer": CallStatus.NO_ANSWER,
};

@Injectable()
export class CloudTalkWebhookService {
  private readonly logger = new Logger(CloudTalkWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const providerCallId = this.extractCallId(payload);
    if (!providerCallId) {
      this.logger.warn(`CloudTalk webhook "${eventType}" had no recognizable call id -- skipped`);
      return;
    }

    const providerEventId = this.extractEventId(payload);
    if (providerEventId) {
      const existingEvent = await this.prisma.callEvent.findUnique({ where: { providerEventId } });
      if (existingEvent) {
        return; // already processed
      }
    }

    let call = await this.prisma.call.findUnique({ where: { providerCallId } });

    if (!call) {
      const agentId = await this.resolveAgentId(payload);
      if (!agentId) {
        this.logger.warn(
          `CloudTalk webhook for call ${providerCallId} could not be attributed to an agent -- skipped`,
        );
        return;
      }
      const contactId = await this.resolveContactId(payload);
      call = await this.prisma.call.create({
        data: {
          provider: "cloudtalk",
          providerCallId,
          agentId,
          contactId,
          direction: this.extractDirection(payload),
          fromNumber: this.extractString(payload, ["caller_number", "from", "caller_id", "from_number"]) ?? "",
          toNumber: this.extractString(payload, ["callee_number", "to", "contact_number", "to_number"]) ?? "",
          status: CallStatus.INITIATED,
        },
      });
    }

    const statusRaw = (
      this.extractString(payload, ["status", "call_status", "event", "action", "state"]) ?? eventType
    ).toLowerCase();

    // Find closest status match
    let status: CallStatus | undefined = undefined;
    for (const [key, val] of Object.entries(STATUS_MAP)) {
      if (statusRaw.includes(key)) {
        status = val;
        break;
      }
    }

    const durationSec = this.extractNumber(payload, ["duration", "call_duration", "billsec", "talking_time"]);
    const recordingUrl = this.extractString(payload, ["recording_url", "recording", "record_url", "audio_url"]);

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
    return this.extractString(payload, ["call_id", "id", "call_uuid", "callId"]);
  }

  private extractEventId(payload: Record<string, unknown>): string | null {
    return this.extractString(payload, ["event_id", "webhook_id", "id"]);
  }

  private extractDirection(payload: Record<string, unknown>): "OUTBOUND" | "INBOUND" {
    const dir = this.extractString(payload, ["direction", "call_direction", "type"])?.toLowerCase();
    return dir === "inbound" || dir === "incoming" ? "INBOUND" : "OUTBOUND";
  }

  private extractString(payload: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === "string" && value.length > 0) return value;
      if (typeof value === "number") return String(value);
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

  private async resolveAgentId(payload: Record<string, unknown>): Promise<string | null> {
    const agentEmail = this.extractString(payload, ["agent_email", "user_email", "email"]);
    if (agentEmail) {
      const user = await this.prisma.user.findUnique({ where: { email: agentEmail.toLowerCase() } });
      if (user) return user.id;
    }
    return null;
  }

  private async resolveContactId(payload: Record<string, unknown>): Promise<string | null> {
    const customerNumber = this.extractString(payload, ["callee_number", "contact_number", "to", "from", "caller_number"]);
    if (!customerNumber) return null;
    const digits = customerNumber.replace(/\D/g, "");
    if (digits.length >= 7) {
      const last10 = digits.slice(-10);
      const contact = await this.prisma.contact.findFirst({
        where: { phone: { contains: last10 } },
      });
      return contact?.id ?? null;
    }
    return null;
  }
}
