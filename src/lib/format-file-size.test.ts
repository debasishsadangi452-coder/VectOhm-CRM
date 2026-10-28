import { describe, expect, it } from "vitest";
import { formatFileSize } from "./format-file-size";

describe("formatFileSize", () => {
  it("formats plain bytes with no decimal", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats an exact unit boundary by rolling into the next unit (still under 10, so keeps the decimal)", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
  });

  it("rounds to a whole number once the value is 10 or more in its unit", () => {
    expect(formatFileSize(15 * 1024)).toBe("15 KB");
  });

  it("keeps one decimal place below 10 units, once past the byte scale", () => {
    expect(formatFileSize(1.5 * 1024)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(148 * 1024 * 1024)).toBe("148 MB");
  });

  it("caps at GB -- does not invent a TB unit (still applies the <10 decimal rule)", () => {
    expect(formatFileSize(5 * 1024 * 1024 * 1024)).toBe("5.0 GB");
  });

  it("handles zero bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });
});
