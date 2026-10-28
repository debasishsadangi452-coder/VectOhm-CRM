import { Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { AiUsageService } from "../ai-usage/ai-usage.service";

export interface IntentEmailContext {
  senderFirstName: string;
  senderCompany: string;
  // What we offer + tone, written by whoever set up the automation.
  offerDescription: string;
  tone: string;
  contactFirstName: string;
  contactTitle: string | null;
  companyName: string;
  signalType: "HIRING" | "NEWS";
  // The job title (HIRING) or the news headline (NEWS) that triggered this.
  signalTitle: string;
  signalDetail: string | null;
}

export interface IntentEmailDraft {
  subject: string;
  body: string;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("No AI key is set (GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY), so AI emails cannot be written.");
  }
}

// Unlike the follow-up drafter there is deliberately NO simulated fallback:
// this feeds a real outbound email, and a placeholder body must never be sent.
@Injectable()
export class IntentAutomationAiService {
  private readonly logger = new Logger(IntentAutomationAiService.name);

  constructor(private readonly aiUsageService: AiUsageService) {}

  isConfigured(): boolean {
    return !!(
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY
    );
  }

  async generateDraft(ctx: IntentEmailContext): Promise<IntentEmailDraft> {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!geminiKey && !openaiKey && !anthropicKey) throw new AiNotConfiguredError();

    let rawText = "";

    if (geminiKey) {
      const client = new OpenAI({
        apiKey: geminiKey,
        baseURL: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/",
      });
      const response = await client.chat.completions.create({
        model: process.env.GEMINI_MODEL || "gemini-flash-latest",
        messages: [
          { role: "system", content: "You are an executive outreach copywriter. Output strictly valid JSON with subject and body keys." },
          { role: "user", content: buildPrompt(ctx) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
      });
      rawText = response.choices[0]?.message?.content || "";
      if (response.usage) {
        this.aiUsageService.recordUsage({
          provider: "GEMINI",
          model: process.env.GEMINI_MODEL || "gemini-flash-latest",
          feature: "INTENT_OUTREACH",
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          metadata: { companyName: ctx.companyName, signalTitle: ctx.signalTitle },
        });
      }
    } else if (openaiKey) {
      const client = new OpenAI({ apiKey: openaiKey });
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an executive outreach copywriter. Output strictly valid JSON with subject and body keys." },
          { role: "user", content: buildPrompt(ctx) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
      });
      rawText = response.choices[0]?.message?.content || "";
      if (response.usage) {
        this.aiUsageService.recordUsage({
          provider: "OPENAI",
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          feature: "INTENT_OUTREACH",
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          metadata: { companyName: ctx.companyName, signalTitle: ctx.signalTitle },
        });
      }
    } else {
      const anthropic = new Anthropic({ apiKey: anthropicKey! });
      const response = await anthropic.messages.create({
        model: process.env.INTENT_AI_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: buildPrompt(ctx) }],
      });
      const block = response.content[0];
      rawText = block?.type === "text" ? block.text : "";
      if (response.usage) {
        this.aiUsageService.recordUsage({
          provider: "ANTHROPIC",
          model: process.env.INTENT_AI_MODEL || "claude-haiku-4-5-20251001",
          feature: "INTENT_OUTREACH",
          promptTokens: response.usage.input_tokens || 0,
          completionTokens: response.usage.output_tokens || 0,
          metadata: { companyName: ctx.companyName, signalTitle: ctx.signalTitle },
        });
      }
    }

    const draft = parseDraft(rawText);
    if (!draft) {
      this.logger.warn(`AI returned an unusable email draft. Raw text was:\n${rawText}`);
      throw new Error("The AI did not return a usable email draft");
    }
    return draft;
  }
}

export function buildPrompt(ctx: IntentEmailContext): string {
  const trigger =
    ctx.signalType === "HIRING"
      ? `${ctx.companyName} has an open position: "${ctx.signalTitle}".`
      : `${ctx.companyName} was recently in the news: "${ctx.signalTitle}".`;
  return `You write one short cold outreach email on behalf of ${ctx.senderFirstName} at ${ctx.senderCompany}.

What we offer (use only this, do not invent services, clients, numbers or results):
${ctx.offerDescription}

Recipient: ${ctx.contactFirstName}${ctx.contactTitle ? `, ${ctx.contactTitle}` : ""} at ${ctx.companyName}.
Why we are writing: ${trigger}${ctx.signalDetail ? `\nExtra detail: ${ctx.signalDetail}` : ""}

Rules:
- Tone: ${ctx.tone}.
- 70 to 120 words, plain text, no markdown, no bullet lists.
- Open by referring naturally to the reason above. Do not claim we know them, have worked with them, or saw anything not stated above.
- Offer one clear, low-pressure next step (a short call).
- Sign off with just "${ctx.senderFirstName}".
- Do not use brackets or template placeholders. Write the actual recipient name "${ctx.contactFirstName}" and company "${ctx.companyName}".

Respond with ONLY valid JSON: {"subject": "...", "body": "..."}`;
}

export function parseDraft(text: string): IntentEmailDraft | null {
  try {
    const cleaned = text.replace(/```(?:json)?/gi, "").trim();
    // Try direct parse first if it is clean JSON
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Find first { and matching balanced or last }
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start !== -1 && end > start) {
        parsed = JSON.parse(cleaned.substring(start, end + 1));
      } else {
        return null;
      }
    }
    const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
    const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (!subject || !body) return null;
    // A leftover template placeholder like [Name], [Company], or {{contact}} means the model didn't finish personalising.
    if (/\[\s*(?:name|company|recipient|insert|title|role|client|first\s*name)\s*\]|\{\{[^}]+\}\}/i.test(subject + body)) {
      return null;
    }
    return { subject, body };
  } catch {
    return null;
  }
}
