export interface ClassificationResult {
  tier: "ERP_AI_VIP" | "ENTERPRISE_HIGH" | "STANDARD_GROWTH";
  isErpAiPriority: boolean;
  intentScore: number;
  erpVendors: string[];
  aiKeywords: string[];
  targetedRoles: string[];
  signalSummary: string;
}

const ERP_VENDOR_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "SAP S/4HANA", pattern: /\b(s\/4hana|s4hana|sap s4|sap s\/4)\b/i },
  { name: "SAP", pattern: /\b(sap|rise with sap|sap btp|sap ariba|sap successfactors|sap ecc)\b/i },
  { name: "Oracle Fusion", pattern: /\b(oracle fusion|oracle erp|oracle cloud erp)\b/i },
  { name: "Oracle NetSuite", pattern: /\b(netsuite|oracle netsuite)\b/i },
  { name: "Oracle", pattern: /\b(oracle|peoplesoft|jd edwards|oci)\b/i },
  { name: "Microsoft Dynamics 365", pattern: /\b(dynamics 365|d365|dynamics ax|dynamics nav|business central)\b/i },
  { name: "Workday", pattern: /\b(workday|workday financial|workday hcm)\b/i },
  { name: "ServiceNow", pattern: /\b(servicenow|now platform)\b/i },
  { name: "Infor", pattern: /\b(infor|cloudsuite|infor m3|infor ln)\b/i },
];

const AI_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Generative AI", pattern: /\b(generative ai|genai|llms?|large language model)\b/i },
  { name: "AI Copilot / Agents", pattern: /\b(copilot|joule|ai agents?|agentic|autonomous agent)\b/i },
  { name: "Enterprise AI", pattern: /\b(artificial intelligence|\bai\b|machine learning|\bml\b|predictive ai)\b/i },
  { name: "Process Automation", pattern: /\b(rpa|intelligent automation|automated workflow|process automation)\b/i },
  { name: "Supply Chain & Analytics AI", pattern: /\b(supply chain ai|predictive logistics|financial ai)\b/i },
];

const TRANSFORMATION_PATTERNS = /\b(implement(?:ing|ation|ed|s)?|migrat(?:ing|ion|ed|es)?|moderniz(?:ing|ation|ed|es)?|transform(?:ing|ation|ed|s)?|upgrad(?:ing|e|ed|es)?|deploy(?:ing|ment|ed|s)?|digital transformation|rollout|replaces?|vendor selection)\b/i;

const HIGH_GROWTH_PATTERNS = /\b(raises?|raised|series\s+[a-f]|ipo|funding|valuation|expands?|expansion|new\s+headquarters|opens?\s+office|acquires?|acquisition|merger|contract\s+award|won\s+\$\d+)\b/i;

export function classifyIntentNews(title: string, content?: string): ClassificationResult {
  const fullText = `${title} ${content || ""}`.toLowerCase();

  const detectedErp: string[] = [];
  for (const { name, pattern } of ERP_VENDOR_PATTERNS) {
    if (pattern.test(fullText)) {
      if (!detectedErp.includes(name)) detectedErp.push(name);
    }
  }

  const detectedAi: string[] = [];
  for (const { name, pattern } of AI_PATTERNS) {
    if (pattern.test(fullText)) {
      if (!detectedAi.includes(name)) detectedAi.push(name);
    }
  }

  const hasTransformation = TRANSFORMATION_PATTERNS.test(fullText);
  const hasHighGrowth = HIGH_GROWTH_PATTERNS.test(fullText);

  // 1. Dynamic base score derived from word density, tech relevance, and content structure (50 - 64 pts)
  let baseScore = 54;
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  if (wordCount > 50) baseScore += 2;
  if (wordCount > 120) baseScore += 3;
  if (wordCount > 300) baseScore += 3;
  if (wordCount > 600) baseScore += 2;

  // Title relevance bonus
  const techMatches = (title.match(/\b(startup|tech|cloud|software|platform|enterprise|business|market|digital|growth|hiring|data|ai|saas|venture)\b/gi) || []).length;
  baseScore += Math.min(techMatches * 2, 6);

  // Content-specific character variance so distinct articles yield distinctly calculated scores
  let titleEntropy = 0;
  for (let i = 0; i < title.length; i++) {
    titleEntropy = (titleEntropy + title.charCodeAt(i) * (i + 1)) % 7;
  }
  baseScore += titleEntropy; // adds 0-6 pts variation based on specific title content

  // 2. Growth / Capital / Milestone triggers (+6 to +16 pts)
  let growthScore = 0;
  if (hasHighGrowth) {
    const fundingCount = (fullText.match(/\b(raises?|series\s+[a-f]|valuation|funding|invests?|acquisition|ipo|merger)\b/gi) || []).length;
    growthScore += 8 + Math.min(fundingCount * 2, 8);
  }
  if (hasTransformation) {
    const transformCount = (fullText.match(TRANSFORMATION_PATTERNS) || []).length;
    growthScore += 7 + Math.min(transformCount * 2, 7);
  }

  // 3. ERP Technology Signal (+14 to +30 pts)
  let erpScore = 0;
  if (detectedErp.length > 0) {
    erpScore += 16;
    if (detectedErp.some(e => e.includes("S/4HANA") || e.includes("Fusion"))) erpScore += 6;
    erpScore += Math.min(detectedErp.length * 3, 8);
  }

  // 4. AI Modernization Signal (+10 to +24 pts)
  let aiScore = 0;
  if (detectedAi.length > 0) {
    aiScore += 12;
    if (detectedAi.some(a => a.includes("Copilot") || a.includes("Agentic") || a.includes("Generative"))) aiScore += 5;
    aiScore += Math.min(detectedAi.length * 2, 6);
  }

  const computedTotal = baseScore + growthScore + erpScore + aiScore;

  // ⭐ TIER 1: ERP AI Intent (Highest Priority, 95 - 99)
  if (detectedErp.length > 0 && (detectedAi.length > 0 || hasTransformation)) {
    const roles: string[] = [];
    if (detectedErp.some(e => e.includes("SAP"))) {
      roles.push("SAP S/4HANA Architects", "SAP Integration Consultants", "ABAP on Cloud Developers");
    }
    if (detectedErp.some(e => e.includes("Oracle"))) {
      roles.push("Oracle Cloud ERP Specialists", "Oracle Financials Consultants", "OCI Cloud Architects");
    }
    if (detectedErp.some(e => e.includes("Dynamics"))) {
      roles.push("Dynamics 365 Functional Consultants", "Power Platform Architects");
    }
    if (detectedAi.length > 0) {
      roles.push("Enterprise AI Engineers", "Data Pipeline Specialists", "Workflow Automation Leads");
    }

    const finalVipScore = Math.min(99, Math.max(95, 95 + Math.min(detectedErp.length + detectedAi.length + (hasTransformation ? 1 : 0), 4)));

    return {
      tier: "ERP_AI_VIP",
      isErpAiPriority: true,
      intentScore: finalVipScore,
      erpVendors: detectedErp,
      aiKeywords: detectedAi,
      targetedRoles: roles.length > 0 ? roles : ["Enterprise Systems Architects", "IT Transformation Directors"],
      signalSummary: `Top-Tier Enterprise Modernization: ${detectedErp.join(" & ")}${detectedAi.length > 0 ? ` + ${detectedAi.join(", ")}` : ""}`,
    };
  }

  // TIER 2: Enterprise High (Score 80 - 94)
  if (computedTotal >= 80 || detectedErp.length > 0 || (hasHighGrowth && hasTransformation)) {
    const finalHighScore = Math.min(94, Math.max(80, computedTotal >= 80 ? computedTotal : 81 + Math.min(detectedErp.length * 3 + (hasHighGrowth ? 4 : 0), 9)));
    return {
      tier: "ENTERPRISE_HIGH",
      isErpAiPriority: false,
      intentScore: finalHighScore,
      erpVendors: detectedErp,
      aiKeywords: detectedAi,
      targetedRoles: ["Enterprise Account Executives", "Engineering Managers", "Cloud Infrastructure Engineers"],
      signalSummary: `Enterprise Buying Signal: Capital expansion or strategic growth milestone`,
    };
  }

  // TIER 3: Standard Company Intent (Score 55 - 79)
  const finalStandardScore = Math.min(79, Math.max(55, computedTotal));
  return {
    tier: "STANDARD_GROWTH",
    isErpAiPriority: false,
    intentScore: finalStandardScore,
    erpVendors: detectedErp,
    aiKeywords: detectedAi,
    targetedRoles: ["Technical Leads", "Software Engineers"],
    signalSummary: `Standard Company Milestone or Press Release`,
  };
}
