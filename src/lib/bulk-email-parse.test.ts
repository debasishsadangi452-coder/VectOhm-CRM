import { describe, expect, it } from "vitest";
import { EMAIL_RE, extractEmailsFromSheet, parseRawEmails } from "./bulk-email-parse";

describe("EMAIL_RE", () => {
  it.each(["a@b.co", "first.last@sub.example.com", "a+tag@x.io", "A@B.COM"])("accepts %s", (v) => {
    expect(EMAIL_RE.test(v)).toBe(true);
  });

  it.each(["", "plain", "a@b", "@b.com", "a@.com", "a b@c.com", "a@b c.com", "a@@b.com", "a@b.com extra"])(
    "rejects %j",
    (v) => {
      expect(EMAIL_RE.test(v)).toBe(false);
    },
  );
});

describe("parseRawEmails", () => {
  it("splits on newlines and commas and trims", () => {
    expect(parseRawEmails("a@x.com, b@x.com\n c@x.com ,\n d@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
    ]);
  });

  it("drops anything that isn't an email", () => {
    expect(parseRawEmails("a@x.com, hello, , b@x, c@x.com")).toEqual(["a@x.com", "c@x.com"]);
  });

  it("removes exact duplicates but keeps first-seen order", () => {
    expect(parseRawEmails("b@x.com\na@x.com\nb@x.com")).toEqual(["b@x.com", "a@x.com"]);
  });

  it("returns an empty list for empty or whitespace-only input", () => {
    expect(parseRawEmails("")).toEqual([]);
    expect(parseRawEmails("  \n , ,\n")).toEqual([]);
  });

  it("handles Windows line endings", () => {
    expect(parseRawEmails("a@x.com\r\nb@x.com")).toEqual(["a@x.com", "b@x.com"]);
  });

  it("doesn't split a 'Name <email>' paste into a valid address", () => {
    expect(parseRawEmails("Jane Doe <jane@x.com>")).toEqual([]);
  });

  // Documents current behaviour: unlike extractEmailsFromSheet, this does not
  // lower-case, so differently-cased copies count as separate here. The server
  // de-duplicates case-insensitively, so only the on-screen "N recipients"
  // count can overstate -- no duplicate is ever actually emailed.
  it("treats differently-cased copies of an address as distinct (server dedupes them)", () => {
    expect(parseRawEmails("A@x.com, a@x.com")).toEqual(["A@x.com", "a@x.com"]);
  });
});

describe("extractEmailsFromSheet", () => {
  it("finds emails in any column of any row", () => {
    expect(
      extractEmailsFromSheet([
        ["Name", "Company", "Email"],
        ["Jane", "Acme", "jane@acme.com"],
        ["bob@acme.com", "Bob", "Acme"],
      ]),
    ).toEqual(["jane@acme.com", "bob@acme.com"]);
  });

  it("lower-cases and de-duplicates across the whole sheet", () => {
    expect(extractEmailsFromSheet([["Jane@Acme.com"], ["jane@acme.com"], [" JANE@ACME.COM "]])).toEqual([
      "jane@acme.com",
    ]);
  });

  it("ignores empty, missing and non-email cells", () => {
    expect(
      extractEmailsFromSheet([
        ["", "n/a", "not an email"],
        [undefined as unknown as string, null as unknown as string, "x@y.com"],
      ]),
    ).toEqual(["x@y.com"]);
  });

  it("copes with numeric cells from spreadsheet parsers", () => {
    expect(extractEmailsFromSheet([[12345 as unknown as string, "a@b.co"]])).toEqual(["a@b.co"]);
  });

  it("returns nothing for an empty sheet", () => {
    expect(extractEmailsFromSheet([])).toEqual([]);
    expect(extractEmailsFromSheet([[]])).toEqual([]);
  });

  it("only matches a cell that is entirely an email, not text containing one", () => {
    expect(extractEmailsFromSheet([["contact: jane@acme.com"]])).toEqual([]);
  });
});
