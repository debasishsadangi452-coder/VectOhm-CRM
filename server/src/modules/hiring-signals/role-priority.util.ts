// Pure title-ranking logic (no contact data) -- adapted from the reference
// repo's companyContactService.js ROLE_PRIORITIES/scoreRolePriority. Used to
// pick the best-fit decision-maker out of an ApolloService.searchPeople
// result set for a given company, and as the default `targetTitles` list for
// a new HiringSignalAutomation.
export const DEFAULT_TARGET_TITLES = [
  "Chief Executive Officer",
  "CEO",
  "Founder",
  "Co-Founder",
  "Chief People Officer",
  "CHRO",
  "VP Human Resources",
  "VP Talent Acquisition",
  "VP People",
  "Head of Talent Acquisition",
  "Head of Recruiting",
  "Director of Talent Acquisition",
  "Director of Recruiting",
  "HR Director",
  "Talent Acquisition Manager",
  "Recruiting Manager",
];

export function scoreRolePriority(title: string | null | undefined): number {
  if (!title) return 10;
  const t = title.toLowerCase();

  if (t.includes("chief people") || t.includes("chro")) return 96;
  if (t.includes("vp talent") || t.includes("vp human resources")) return 94;
  if (t.includes("head of talent") || t.includes("head of recruiting")) return 92;
  if (t.includes("director of talent") || t.includes("director of recruiting")) return 85;
  if (t.includes("hr director")) return 82;
  if (t.includes("talent acquisition manager") || t.includes("recruiting manager")) return 80;
  if (t.includes("head of people") || t.includes("people operations")) return 78;
  if (t.includes("ceo") || t.includes("chief executive")) return 100;
  if (t.includes("founder")) return 98;
  return 40;
}
