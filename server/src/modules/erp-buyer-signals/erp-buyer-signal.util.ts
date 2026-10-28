// Classifying job postings as ERP buying signals, and screening out postings
// that are not from the buyer itself.

export type BuyerStage = "SELECTING" | "IMPLEMENTING";

// The company is choosing, replacing or outgrowing a system: shopping now.
const SELECTING_TERMS: Array<{ label: string; re: RegExp }> = [
  { label: "ERP selection/evaluation", re: /\bERP (?:selection|evaluation|assessment|vendor|RFP|search)\b/i },
  { label: "selecting an ERP", re: /\b(?:select(?:ing)?|evaluat(?:e|ing)|choos(?:e|ing)|research(?:ing)?) (?:a |an |the |our )?(?:new )?(?:ERP|enterprise resource planning)\b/i },
  { label: "new ERP", re: /\b(?:a |an |the )?new ERP\b/i },
  { label: "ERP replacement", re: /\breplac(?:e|ing|ement of) (?:our |the |a )?(?:legacy |current |existing |old )?(?:ERP|accounting system|financial system|enterprise system)\b/i },
  { label: "outgrown current system", re: /\boutgrow(?:n|ing)? (?:QuickBooks|Sage|our (?:current|existing|accounting) (?:system|software)|spreadsheets)\b/i },
  { label: "moving off QuickBooks", re: /\b(?:transition(?:ing)?|migrat(?:e|ing|ion)|mov(?:e|ing)) (?:from|off) (?:QuickBooks|Sage 50|Excel|spreadsheets)\b/i },
];

// A vendor is already chosen and the project is under way.
const IMPLEMENTING_TERMS: Array<{ label: string; re: RegExp }> = [
  { label: "ERP implementation", re: /\bERP (?:implementation|migration|rollout|roll-out|go-live|transformation|upgrade|project|program)\b/i },
  { label: "implementing an ERP", re: /\bimplement(?:ing|ation of)? (?:a |an |the |our )?(?:new )?(?:ERP|NetSuite|Dynamics 365|SAP|Oracle Fusion|Acumatica|Epicor|Infor)\b/i },
  { label: "migration to ERP", re: /\bmigrat(?:e|ing|ion) to (?:NetSuite|Dynamics 365|SAP|Oracle|Acumatica|Sage Intacct|Epicor|Infor)\b/i },
];

export function classifyBuyerSignal(
  title: string,
  description: string | null,
): { stage: BuyerStage; matchedTerms: string[] } | null {
  const text = `${title}\n${description ?? ""}`;
  const selecting = SELECTING_TERMS.filter((t) => t.re.test(text)).map((t) => t.label);
  if (selecting.length > 0) return { stage: "SELECTING", matchedTerms: selecting };
  const implementing = IMPLEMENTING_TERMS.filter((t) => t.re.test(text)).map((t) => t.label);
  if (implementing.length > 0) return { stage: "IMPLEMENTING", matchedTerms: implementing };
  return null;
}

// Staffing/recruiting firms, consultancies, systems integrators and the ERP
// vendors themselves post these roles on behalf of someone else or to sell
// services, so they are not buyers.
const INTERMEDIARY_NAME_RE =
  /\b(staffing|employment|search group|recruit(?:ing|ment|ers?)?|talent|headhunt\w*|placement|workforce|resourc(?:e|ing)|consult(?:ing|ants?|ancy)|advisory|outsourc\w*|professional services)\b/i;

const KNOWN_INTERMEDIARIES_RE =
  /\b(robert half|jobot|insight global|randstad|kforce|teksystems|tek systems|apex systems|judge group|motion recruitment|beacon hill|aston carter|collabera|adecco|manpower|hays|kelly services|volt|cybercoders|dice|lensa|talentify|jooble|accenture|deloitte|pwc|pricewaterhousecoopers|kpmg|ernst|\bey\b|cgi|rsm|bdo|grant thornton|cognizant|infosys|wipro|tata consultancy|tcs|capgemini|hcl|ibm|oracle|sap|microsoft|workday|netsuite|acumatica|epicor|infor|sage|odoo|salesforce|systemsaccountants|central point partners|project fixers|outcome logix|nextplay|relq|cbiz|sparks group|it gig|s\+h search|connectwork)(?![a-z])/i;

const ON_BEHALF_RE =
  /\b(our client|on behalf of (?:our|a) client|client is (?:seeking|looking|hiring)|we are (?:recruiting|hiring) for (?:a|our) client|confidential (?:client|company)|direct hire opportunity with a)\b/i;

export function isIntermediary(companyName: string, description: string | null): boolean {
  return (
    INTERMEDIARY_NAME_RE.test(companyName) ||
    KNOWN_INTERMEDIARIES_RE.test(companyName) ||
    ON_BEHALF_RE.test(description ?? "")
  );
}
