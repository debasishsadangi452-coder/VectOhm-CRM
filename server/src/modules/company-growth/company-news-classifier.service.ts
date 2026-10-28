import { Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import type { CompanyGrowthSignalType } from "@prisma/client";
import type { NewsApiArticle } from "./adapters/newsapi.adapter";

export interface NewsClassification {
  relevant: boolean;
  type: Extract<CompanyGrowthSignalType, "NEWS_EXPANSION" | "NEWS_FUNDING" | "NEWS_DEAL"> | null;
  // Plain-language, sales-facing summary -- shown directly in the Growth
  // Signals feed, e.g. "Raised $40M Series B, plans to double engineering
  // headcount".
  summary: string | null;
}

const NOT_RELEVANT: NewsClassification = { relevant: false, type: null, summary: null };

// Same @anthropic-ai/sdk + ANTHROPIC_API_KEY pattern as FollowUpAiService --
// copied rather than reinvented. Deliberately does NOT fall back to a
// "simulated" classification the way follow-up drafting does: a wrong
// draft email is harmless to edit before sending, but a wrong "this
// company is expanding" claim shown to Sales as a real signal is not, so
// with no API key every article is just treated as not relevant (skipped)
// rather than guessed at.
@Injectable()
export class CompanyNewsClassifierService {
  private readonly logger = new Logger(CompanyNewsClassifierService.name);

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async classify(companyName: string, article: NewsApiArticle): Promise<NewsClassification> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NOT_RELEVANT;

    try {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 300,
        messages: [{ role: "user", content: this.buildPrompt(companyName, article) }],
      });

      const block = response.content[0];
      const text = block.type === "text" ? block.text : "";
      return this.parseClassification(text) ?? NOT_RELEVANT;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to classify news article with Claude: ${message}`);
      return NOT_RELEVANT;
    }
  }

  private buildPrompt(companyName: string, article: NewsApiArticle): string {
    return `You are screening a news article for a B2B sales team to decide if it's a genuine business-growth signal worth a sales rep's attention for the company "${companyName}".

Article title: ${article.title}
Article description: ${article.description ?? "(none provided)"}

A signal is relevant ONLY if the article is clearly about THIS specific company (not a different company with a similar name, and not just a passing mention) doing one of:
- Raising funding / a funding round
- Expanding operations, opening new offices, or entering new markets
- Signing a major deal, partnership, or acquisition

If relevant, write a short (under 25 words) plain-language, sales-facing summary of what happened and why it might mean they need more hires or are worth reaching out to now.

Respond with ONLY valid JSON in this exact shape, no other text:
{"relevant": true, "type": "NEWS_FUNDING", "summary": "..."}
or
{"relevant": false, "type": null, "summary": null}

"type" must be exactly one of "NEWS_EXPANSION", "NEWS_FUNDING", "NEWS_DEAL" when relevant is true.`;
  }

  private parseClassification(text: string): NewsClassification | null {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.relevant !== "boolean") return null;
      if (!parsed.relevant) return NOT_RELEVANT;

      const validTypes = ["NEWS_EXPANSION", "NEWS_FUNDING", "NEWS_DEAL"];
      if (typeof parsed.summary !== "string" || !validTypes.includes(parsed.type)) return null;

      return { relevant: true, type: parsed.type, summary: parsed.summary };
    } catch {
      return null;
    }
  }
}
