import { describe, expect, it } from "vitest";
import { renderMergeFields } from "./merge-fields";

describe("renderMergeFields", () => {
  const sample = {
    firstName: "Ada",
    lastName: "Lovelace",
    title: "Engineer",
    companyName: "Analytical Engines Inc",
  };

  it("substitutes all known merge fields", () => {
    const result = renderMergeFields(
      "Hi {{firstName}} {{lastName}}, as {{title}} at {{companyName}}...",
      sample,
    );
    expect(result).toBe("Hi Ada Lovelace, as Engineer at Analytical Engines Inc...");
  });

  it("tolerates extra whitespace inside the braces", () => {
    expect(renderMergeFields("Hi {{  firstName  }}", sample)).toBe("Hi Ada");
  });

  it("leaves an unknown token untouched rather than blanking it", () => {
    expect(renderMergeFields("Hi {{nickname}}", sample)).toBe("Hi {{nickname}}");
  });

  it("falls back to an empty string for optional fields that are missing", () => {
    expect(
      renderMergeFields("{{title}} at {{companyName}}", { firstName: "Ada", lastName: "Lovelace" }),
    ).toBe(" at ");
  });

  it("replaces every occurrence, not just the first", () => {
    expect(renderMergeFields("{{firstName}}, {{firstName}}!", sample)).toBe("Ada, Ada!");
  });

  it("passes through a template with no merge fields unchanged", () => {
    expect(renderMergeFields("No fields here.", sample)).toBe("No fields here.");
  });
});
