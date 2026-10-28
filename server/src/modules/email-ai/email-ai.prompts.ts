// Prompts and output checks for the email AI (Gemini). Kept free of any network code so they can be tested.
//
// The rules that matter most: the model must not invent facts about us or the recipient, must keep the
// merge fields ({{firstName}} ...) the CRM fills in at send time, and must never leave a placeholder
// like [Name] in a finished email.

/** The merge fields the CRM can fill in (see common/utils/merge-fields.ts). */
export const MERGE_FIELDS = ["firstName", "lastName", "title", "companyName"] as const;

export type RewriteInstruction = "SHORTER" | "LONGER" | "FRIENDLIER" | "FORMAL" | "FIX" | "TRANSLATE" | "CUSTOM";

export interface TemplateRequest {
  goal: string;
  tone?: string;
  audience?: string;
  language?: string;
  length?: "short" | "medium" | "long";
}

export interface RewriteRequest {
  subject?: string;
  body: string;
  instruction: RewriteInstruction;
  language?: string;
  custom?: string;
}

export interface PersonalizeRequest {
  baseSubject: string;
  baseBody: string;
  recipient: { firstName: string; lastName: string; title: string | null; companyName: string | null };
  instructions?: string | null;
}

export interface EmailDraft {
  subject: string;
  body: string;
}

const LENGTH_WORDS: Record<NonNullable<TemplateRequest["length"]>, string> = {
  short: "60 to 90 words",
  medium: "100 to 150 words",
  long: "170 to 230 words",
};

const MERGE_FIELD_HELP = `Merge fields you may use, written exactly like this: {{firstName}}, {{lastName}}, {{title}}, {{companyName}}. The CRM replaces them with each recipient's real details when the email is sent. Use no other {{...}} fields.`;

export const SYSTEM_PROMPT =
  "You are an expert business email copywriter. You write clear, honest emails that sound like a real person. You output strictly valid JSON and nothing else.";

export function buildTemplatePrompt(req: TemplateRequest): string {
  return `Write a reusable email template.

What the email is for: ${req.goal.trim()}
${req.audience?.trim() ? `Who it goes to: ${req.audience.trim()}\n` : ""}Tone: ${req.tone?.trim() || "friendly and professional"}.
Language: ${req.language?.trim() || "English"}.
Length: ${LENGTH_WORDS[req.length ?? "medium"]}.

${MERGE_FIELD_HELP} Greet the recipient with {{firstName}}. Use {{companyName}} or {{title}} only where it reads naturally.

Rules:
- Plain text only: no markdown, no bullet symbols, no HTML.
- Do not invent facts, clients, numbers, results or promises. Use only what is stated above.
- One clear, low-pressure call to action.
- End with a short closing such as "Best regards," and nothing after it. The sender's name is added separately.
- Do not use square-bracket placeholders like [Name] or [Company].

Respond with ONLY JSON: {"name": "a short template name", "subject": "...", "body": "..."}`;
}

const REWRITE_TEXT: Record<Exclude<RewriteInstruction, "CUSTOM" | "TRANSLATE">, string> = {
  SHORTER: "Make it noticeably shorter and tighter. Keep the key message and the call to action.",
  LONGER: "Expand it a little with natural detail, without inventing facts. Keep it easy to read.",
  FRIENDLIER: "Make the tone warmer and friendlier while staying professional.",
  FORMAL: "Make the tone more formal and polished.",
  FIX: "Fix spelling, grammar and punctuation only. Do not change the wording otherwise.",
};

export function buildRewritePrompt(req: RewriteRequest): string {
  const instruction =
    req.instruction === "TRANSLATE"
      ? `Translate it into ${req.language?.trim() || "English"}. Keep the meaning and tone.`
      : req.instruction === "CUSTOM"
        ? (req.custom?.trim() ?? "Improve it.")
        : REWRITE_TEXT[req.instruction];
  return `Rewrite this email.

Instruction: ${instruction}

${MERGE_FIELD_HELP} Keep every merge field that appears below exactly as written, and keep every link unchanged.

Rules:
- Plain text only: no markdown or HTML.
- Do not invent facts, numbers or claims that are not in the original.
- Do not use square-bracket placeholders.

${req.subject !== undefined ? `Subject: ${req.subject}\n` : ""}Body:
${req.body}

Respond with ONLY JSON: {"subject": "...", "body": "..."}${req.subject === undefined ? ' (leave "subject" as an empty string)' : ""}`;
}

export function buildSubjectsPrompt(input: { subject?: string; body: string; tone?: string; count: number }): string {
  return `Suggest ${input.count} different subject lines for this email.

Tone: ${input.tone?.trim() || "friendly and professional"}.
${MERGE_FIELD_HELP}

Rules:
- Each under 70 characters. No ALL CAPS, no clickbait, no emojis, no spammy words.
- Honest about what the email contains. Do not use square-bracket placeholders.
${input.subject ? `\nCurrent subject (give different ideas): ${input.subject}\n` : ""}
Email body:
${input.body}

Respond with ONLY JSON: {"subjects": ["...", "..."]}`;
}

export function buildPersonalizePrompt(req: PersonalizeRequest): string {
  const r = req.recipient;
  const who = [`${r.firstName} ${r.lastName}`.trim() || "the recipient", r.title ? `(${r.title})` : "", r.companyName ? `at ${r.companyName}` : ""]
    .filter(Boolean)
    .join(" ");
  return `Personalise this email for one recipient so it reads as written just for them, not as a mass mailing.

Recipient: ${who}.
${req.instructions?.trim() ? `Guidance from the sender: ${req.instructions.trim()}\n` : ""}
Rules:
- Keep the same message, offer, call to action, links and sign-off. Change mainly the opening lines and a little wording so it fits this person's role and company.
- Use only the recipient details above. Do not invent facts about them or their company, and do not claim we have worked with them or seen anything not stated.
- Stay close to the original length, plain text, no markdown.
- Keep the recipient's real name. Do not use square-bracket placeholders or {{...}} fields.

Original subject: ${req.baseSubject}
Original body:
${req.baseBody}

Respond with ONLY JSON: {"subject": "...", "body": "..."}`;
}

// ─── output checks ───────────────────────────────────────────────────────────

/** Pulls a JSON object out of a model reply, tolerating code fences and surrounding prose. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

const MERGE_TOKEN = /\{\{\s*([\w]+)\s*\}\}/g;
const BRACKET_PLACEHOLDER = /\[\s*(?:name|company|recipient|insert|title|role|client|first\s*name|your\s*name|sender)[^\]]*\]/i;

/** True if the text has a {{field}} the CRM can't fill, or a leftover [Name]-style placeholder. */
export function hasBadPlaceholder(text: string, allowMergeFields: boolean): boolean {
  if (BRACKET_PLACEHOLDER.test(text)) return true;
  for (const match of text.matchAll(MERGE_TOKEN)) {
    if (!allowMergeFields) return true;
    if (!(MERGE_FIELDS as readonly string[]).includes(match[1])) return true;
  }
  return false;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** A new template: needs a name, subject and body, and may use only the supported merge fields. */
export function parseTemplateDraft(text: string): (EmailDraft & { name: string }) | null {
  const o = parseJsonObject(text);
  if (!o) return null;
  const name = str(o.name);
  const subject = str(o.subject);
  const body = str(o.body);
  if (!name || !subject || !body) return null;
  if (hasBadPlaceholder(`${subject}\n${body}`, true)) return null;
  return { name: name.slice(0, 80), subject, body };
}

/** A rewrite: body required; subject optional (only checked when one was sent). */
export function parseRewrite(text: string, hadSubject: boolean): { subject?: string; body: string } | null {
  const o = parseJsonObject(text);
  if (!o) return null;
  const subject = str(o.subject);
  const body = str(o.body);
  if (!body || (hadSubject && !subject)) return null;
  if (hasBadPlaceholder(`${subject}\n${body}`, true)) return null;
  return hadSubject ? { subject, body } : { body };
}

export function parseSubjects(text: string, count: number): string[] | null {
  const o = parseJsonObject(text);
  if (!o || !Array.isArray(o.subjects)) return null;
  const seen = new Set<string>();
  const subjects: string[] = [];
  for (const raw of o.subjects) {
    const s = str(raw).replace(/^["']|["']$/g, "");
    if (!s || s.length > 120 || seen.has(s.toLowerCase()) || hasBadPlaceholder(s, true)) continue;
    seen.add(s.toLowerCase());
    subjects.push(s);
    if (subjects.length === count) break;
  }
  return subjects.length > 0 ? subjects : null;
}

/**
 * A personalised email replaces a finished one, so it is checked harder: no placeholders at all, and
 * not wildly longer or shorter than the original (a runaway or truncated reply must not be sent).
 */
export function parsePersonalized(text: string, original: EmailDraft): EmailDraft | null {
  const o = parseJsonObject(text);
  if (!o) return null;
  const subject = str(o.subject);
  const body = str(o.body);
  if (!subject || !body) return null;
  if (hasBadPlaceholder(`${subject}\n${body}`, false)) return null;
  const ratio = body.length / Math.max(1, original.body.length);
  if (ratio < 0.5 || ratio > 2.5) return null;
  return { subject, body };
}
