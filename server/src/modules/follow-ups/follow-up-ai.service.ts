import { Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";

export interface FollowUpDraftContext {
  contactFirstName: string;
  contactLastName: string;
  companyName: string | null;
  // Campaign/sequence name, and the original subject line if known --
  // both optional since a follow-up can be scheduled with only partial
  // context (e.g. the owning template was since deleted).
  sourceName: string | null;
  originalSubject: string | null;
  openCount: number;
  clickCount: number;
  engagementScore: number;
  senderFirstName: string;
}

export interface FollowUpDraft {
  subject: string;
  body: string;
}

// Same @anthropic-ai/sdk + ANTHROPIC_API_KEY + simulated-fallback shape as
// SeoContentBriefsService.generateDraft -- the one AI-generation pattern
// already established in this codebase, copied rather than reinvented.
@Injectable()
export class FollowUpAiService {
  private readonly logger = new Logger(FollowUpAiService.name);

  async generateDraft(ctx: FollowUpDraftContext): Promise<FollowUpDraft> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return this.simulatedDraft(ctx);
    }

    try {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: this.buildPrompt(ctx),
          },
        ],
      });

      const block = response.content[0];
      const text = block.type === "text" ? block.text : "";
      const parsed = this.parseDraft(text);
      return parsed ?? this.simulatedDraft(ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to generate follow-up draft with Claude: ${message}`);
      return this.simulatedDraft(ctx);
    }
  }

  private buildPrompt(ctx: FollowUpDraftContext): string {
    return `You are writing a brief, warm follow-up sales email on behalf of ${ctx.senderFirstName}. The recipient, ${ctx.contactFirstName} ${ctx.contactLastName}${ctx.companyName ? ` at ${ctx.companyName}` : ""}, opened a previous email${ctx.originalSubject ? ` with subject "${ctx.originalSubject}"` : ""}${ctx.sourceName ? ` from "${ctx.sourceName}"` : ""} ${ctx.openCount} time(s)${ctx.clickCount > 0 ? ` and clicked a link ${ctx.clickCount} time(s)` : ""}. Their current engagement score is ${ctx.engagementScore}.

Write a short (under 100 words) follow-up email checking in and proposing a quick 15-minute conversation. Respond with ONLY valid JSON in this exact shape, no other text: {"subject": "...", "body": "..."}`;
  }

  private parseDraft(text: string): FollowUpDraft | null {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.subject === "string" && typeof parsed.body === "string") {
        return { subject: parsed.subject, body: parsed.body };
      }
      return null;
    } catch {
      return null;
    }
  }

  private simulatedDraft(ctx: FollowUpDraftContext): FollowUpDraft {
    const company = ctx.companyName ? ` at ${ctx.companyName}` : "";
    return {
      subject: `Following up${ctx.originalSubject ? `: ${ctx.originalSubject}` : ""}`,
      body:
        `Hi ${ctx.contactFirstName},\n\n` +
        `I noticed you had a chance to review my previous email${company}. ` +
        `I wanted to check if you'd be interested in discussing how we could help.\n\n` +
        `Would you be available for a quick 15-minute conversation this week?\n\n` +
        `Best regards,\n${ctx.senderFirstName}\n\n` +
        `(Simulated draft -- ANTHROPIC_API_KEY not set)`,
    };
  }
}
