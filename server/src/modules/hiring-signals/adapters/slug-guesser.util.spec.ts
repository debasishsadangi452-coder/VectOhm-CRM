import { deriveSlugCandidates } from "./slug-guesser.util";

describe("deriveSlugCandidates", () => {
  it("derives a plain-name slug from a company name", () => {
    expect(deriveSlugCandidates("Stripe")).toContain("stripe");
  });

  it("derives hyphenated and squashed variants from a multi-word name", () => {
    const candidates = deriveSlugCandidates("Open AI");
    expect(candidates).toContain("openai");
    expect(candidates).toContain("open-ai");
  });

  it("derives a slug from the domain when one is provided", () => {
    expect(deriveSlugCandidates("Snowflake Computing", "snowflake.com")).toContain("snowflake");
  });

  it("never returns single-character candidates", () => {
    const candidates = deriveSlugCandidates("A B");
    expect(candidates.every((c) => c.length >= 2)).toBe(true);
  });

  it("returns no candidates for an empty name and no domain", () => {
    expect(deriveSlugCandidates("")).toEqual([]);
  });
});
