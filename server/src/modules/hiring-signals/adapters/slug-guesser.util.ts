// Greenhouse/Ashby/Lever board APIs are keyed by a company-chosen slug, not
// its real name or domain, so there's no direct lookup -- the reference
// repo's greenhouse-discover.ts approach (try plausible slug variants,
// keep whichever the board actually recognizes) is legitimate since it's
// just guessing at a public, harmless identifier, not any kind of
// credential. Generalized here across all three board adapters instead of
// just Greenhouse.
export function deriveSlugCandidates(companyName: string, domain?: string | null): string[] {
  const variants = new Set<string>();
  const addFrom = (raw: string) => {
    const base = raw.toLowerCase().trim();
    if (!base) return;
    variants.add(base.replace(/\s+/g, ""));
    variants.add(base.replace(/\s+/g, "-"));
    variants.add(base.replace(/[^a-z0-9]/g, ""));
    variants.add(base.replace(/[^a-z0-9]/g, "-"));
    variants.add(base.split(/\s+/)[0]);
  };

  addFrom(companyName);
  if (domain) {
    // "stripe.com" -> "stripe"
    addFrom(domain.split(".")[0]);
  }

  return Array.from(variants).filter((v) => v.length >= 2);
}
