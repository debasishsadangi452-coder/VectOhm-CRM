// Whether a person's department name matches a target department, allowing for the different spellings
// in use (Dev / Development, HR / Human Resources, Marketing / SEO ...).
export function isDepartmentMatch(userDeptName?: string | null, targetDeptName?: string): boolean {
  if (!userDeptName || !targetDeptName) return false;
  const u = userDeptName.toLowerCase().trim();
  const t = targetDeptName.toLowerCase().trim();
  if (u === t) return true;
  if ((t === "hr" || t.includes("human resource")) && (u === "hr" || u.includes("human resource"))) return true;
  if ((t === "dev" || t.includes("develop")) && (u === "dev" || u.includes("develop"))) return true;
  if (t.includes("sales") && u.includes("sales")) return true;
  if (t.includes("recruit") && u.includes("recruit")) return true;
  if ((t.includes("marketing") || t.includes("seo")) && (u.includes("marketing") || u.includes("seo"))) return true;
  return false;
}
