import OpenAI from "openai";

export type IntentSignalType = "ERP_AI" | "FUNDING" | "EXPANSION" | "HIRING" | "OTHER";

export interface IntentAiInput {
  title: string;
  source?: string;
  text?: string;
}

export interface IntentAiResult {
  relevant: boolean;
  signalType: IntentSignalType;
  intentScore: number;
  companyName: string | null;
  companyDomain: string | null;
  summary: string | null;
  erpVendors: string[];
  aiKeywords: string[];
  targetedRoles: string[];
}

const SIGNAL_TYPES: IntentSignalType[] = ["ERP_AI", "FUNDING", "EXPANSION", "HIRING", "OTHER"];

export function isIntentAiConfigured(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY);
}

function client(): { client: OpenAI; model: string } | null {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    return {
      client: new OpenAI({
        apiKey: geminiKey,
        baseURL: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/",
      }),
      model: process.env.GEMINI_MODEL || "gemini-flash-latest",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return { client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), model: process.env.OPENAI_MODEL || "gpt-4o-mini" };
  }
  return null;
}

export function buildIntentPrompt(items: IntentAiInput[]): string {
  const list = items
    .map((it, i) => {
      const body = it.text ? `\n   Text: ${it.text.slice(0, 4000).replace(/\s+/g, " ")}` : "";
      return `${i}. Headline: ${it.title}${it.source ? ` (source: ${it.source})` : ""}${body}`;
    })
    .join("\n");
  return `You qualify B2B sales leads for a company that supplies ERP/AI implementation consultants and technical staffing.
For each news item below, decide whether it shows a specific company with buying intent of one of these types:
- ERP_AI: selecting, migrating to, implementing or going live on an ERP/enterprise platform (SAP, S/4HANA, Oracle, NetSuite, Dynamics 365, Workday, ServiceNow, Infor, Salesforce) or rolling out enterprise AI/automation.
- FUNDING: raised money (seed to IPO), big investment.
- EXPANSION: new office/plant/HQ, entering new markets, acquisition.
- HIRING: hiring many people, especially tech/IT/ERP roles.
Not relevant: vendor marketing, opinion pieces, lists, stock-price chatter, items with no single identifiable buyer company. The ERP/AI vendor itself is NOT the buyer — the customer is.

intentScore 0-100: 90+ = concrete, recent project/deal by a named company; 70-89 = clear signal; below 60 = weak or not relevant.
targetedRoles: 2-4 job titles of people to contact at the buyer company about this.

Items:
${list}

Respond with ONLY JSON: {"results":[{"i":0,"relevant":true,"signalType":"ERP_AI","intentScore":88,"companyName":"Acme Corp","companyDomain":"acme.com","summary":"one sentence for a salesperson","erpVendors":["SAP S/4HANA"],"aiKeywords":["Generative AI"],"targetedRoles":["CIO"]}]}
Include every item index exactly once. Use null for unknown companyName/companyDomain.`;
}

function strings(v: unknown, max = 10): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim().slice(0, 100)).slice(0, max) : [];
}

function str(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim().slice(0, max) : null;
}

// Returns one entry per input index; null where the model gave nothing usable.
export function parseIntentAnalysis(text: string, count: number): (IntentAiResult | null)[] {
  const out: (IntentAiResult | null)[] = new Array(count).fill(null);
  let parsed: any;
  try {
    const cleaned = text.replace(/```(?:json)?/gi, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    parsed = JSON.parse(start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned);
  } catch {
    return out;
  }
  for (const r of Array.isArray(parsed?.results) ? parsed.results : []) {
    const i = Number(r?.i);
    if (!Number.isInteger(i) || i < 0 || i >= count) continue;
    const score = Math.round(Number(r.intentScore));
    out[i] = {
      relevant: r.relevant === true,
      signalType: SIGNAL_TYPES.includes(r.signalType) ? r.signalType : "OTHER",
      intentScore: Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0,
      companyName: str(r.companyName, 200),
      companyDomain: str(r.companyDomain, 255)?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") || null,
      summary: str(r.summary, 1000),
      erpVendors: strings(r.erpVendors),
      aiKeywords: strings(r.aiKeywords),
      targetedRoles: strings(r.targetedRoles, 6),
    };
  }
  return out;
}

export function tierFor(r: IntentAiResult): "ERP_AI_VIP" | "ENTERPRISE_HIGH" | "STANDARD_GROWTH" {
  if (r.signalType === "ERP_AI" && r.intentScore >= 85) return "ERP_AI_VIP";
  if (r.intentScore >= 80) return "ENTERPRISE_HIGH";
  return "STANDARD_GROWTH";
}

export async function analyzeIntentItems(items: IntentAiInput[]): Promise<(IntentAiResult | null)[]> {
  const ai = client();
  if (!ai || items.length === 0) return items.map(() => null);
  const response = await ai.client.chat.completions.create({
    model: ai.model,
    messages: [
      { role: "system", content: "You are a precise B2B sales intent analyst. Output strictly valid JSON." },
      { role: "user", content: buildIntentPrompt(items) },
    ],
    response_format: { type: "json_object" },
    max_tokens: 8192,
  });
  return parseIntentAnalysis(response.choices[0]?.message?.content || "", items.length);
}
