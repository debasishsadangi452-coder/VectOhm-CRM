import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import OpenAI from "openai";
import { AiUsageService } from "../ai-usage/ai-usage.service";
import {
  SYSTEM_PROMPT,
  buildPersonalizePrompt,
  buildRewritePrompt,
  buildSubjectsPrompt,
  buildTemplatePrompt,
  parsePersonalized,
  parseRewrite,
  parseSubjects,
  parseTemplateDraft,
  type EmailDraft,
  type PersonalizeRequest,
  type RewriteRequest,
  type TemplateRequest,
} from "./email-ai.prompts";

export type EmailAiFeature = "EMAIL_TEMPLATE" | "EMAIL_REWRITE" | "EMAIL_SUBJECTS" | "EMAIL_PERSONALIZE";

// A person can click "Generate" quickly and repeatedly; this keeps a runaway tab (or a script) from running up
// the company's Gemini bill. Sends from a campaign (personalising each recipient) are not limited this way.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 40;

/** Writes and improves emails with Gemini, using the company key (GEMINI_API_KEY) set by an Admin. */
@Injectable()
export class EmailAiService {
  private readonly logger = new Logger(EmailAiService.name);
  private readonly recent = new Map<string, number[]>();

  constructor(private readonly aiUsage: AiUsageService) {}

  isConfigured(): boolean {
    return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  }

  // ─── what the UI calls ─────────────────────────────────────────────────────

  generateTemplate(req: TemplateRequest, userId: string) {
    this.checkRate(userId);
    return this.run(buildTemplatePrompt(req), parseTemplateDraft, "EMAIL_TEMPLATE", userId);
  }

  rewrite(req: RewriteRequest, userId: string) {
    this.checkRate(userId);
    const hadSubject = req.subject !== undefined && req.subject !== "";
    return this.run(
      buildRewritePrompt({ ...req, subject: hadSubject ? req.subject : undefined }),
      (text) => parseRewrite(text, hadSubject),
      "EMAIL_REWRITE",
      userId,
    );
  }

  async suggestSubjects(input: { subject?: string; body: string; tone?: string; count: number }, userId: string) {
    this.checkRate(userId);
    const subjects = await this.run(
      buildSubjectsPrompt(input),
      (text) => parseSubjects(text, input.count),
      "EMAIL_SUBJECTS",
      userId,
    );
    return { subjects };
  }

  /** Strict version for the preview button: an error is shown to the user rather than hidden. */
  personalizePreview(req: PersonalizeRequest, userId: string) {
    this.checkRate(userId);
    return this.run(
      buildPersonalizePrompt(req),
      (text) => parsePersonalized(text, { subject: req.baseSubject, body: req.baseBody }),
      "EMAIL_PERSONALIZE",
      userId,
    );
  }

  /**
   * Used while sending a campaign: returns the tailored email, or null if the AI is unavailable or gave
   * something unsafe, so the caller can send the original instead of failing the recipient.
   */
  async personalizeForSend(req: PersonalizeRequest, userId: string): Promise<EmailDraft | null> {
    if (!this.isConfigured()) return null;
    try {
      return await this.run(
        buildPersonalizePrompt(req),
        (text) => parsePersonalized(text, { subject: req.baseSubject, body: req.baseBody }),
        "EMAIL_PERSONALIZE",
        userId,
      );
    } catch (err) {
      this.logger.warn(`Personalising an email failed, sending the original: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  // ─── Gemini ────────────────────────────────────────────────────────────────

  private checkRate(userId: string) {
    const now = Date.now();
    const recent = (this.recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
      throw new HttpException(
        "You have used the AI writing tools a lot in the last few minutes. Please wait a bit and try again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.recent.set(userId, recent);
  }

  /** One attempt, plus one retry if the reply cannot be used. */
  private async run<T>(
    prompt: string,
    parse: (text: string) => T | null,
    feature: EmailAiFeature,
    userId: string,
  ): Promise<T> {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
      throw new ServiceUnavailableException(
        "AI email writing isn't set up yet. Ask an Admin to add the Gemini key (GEMINI_API_KEY).",
      );
    }
    const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
    const client = new OpenAI({
      apiKey: key,
      baseURL: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/",
    });

    for (let attempt = 1; attempt <= 2; attempt++) {
      let text = "";
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 4096,
        });
        text = response.choices[0]?.message?.content || "";
        if (response.usage) {
          this.aiUsage.recordUsage({
            userId,
            provider: "GEMINI",
            model,
            feature,
            promptTokens: response.usage.prompt_tokens || 0,
            completionTokens: response.usage.completion_tokens || 0,
          });
        }
      } catch (err) {
        this.logger.error(`Gemini request failed (${feature}): ${err instanceof Error ? err.message : err}`);
        throw new ServiceUnavailableException("The AI service didn't respond. Please try again in a moment.");
      }

      const parsed = parse(text);
      if (parsed) return parsed;
      this.logger.warn(`Gemini returned an unusable reply for ${feature} (attempt ${attempt})`);
    }
    throw new UnprocessableEntityException("The AI didn't return a usable email. Try again, or reword your request.");
  }
}
