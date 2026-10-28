import { renderMergeFields } from "./merge-fields";
import { composeEmailHtml, isHtmlBody, toEmailHtml } from "./email-body";
import { rewriteLinksForTracking } from "./rewrite-links";
import { appendTrackingFooter } from "./email-tracking";
import {
  buildUnsubscribeUrl,
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./unsubscribe-token";
import { followUpColdSince, FOLLOW_UP_COLD_DAYS } from "./follow-up";

describe("renderMergeFields", () => {
  const contact = { firstName: "Jane", lastName: "Doe", title: "CTO", companyName: "Acme" };

  it("fills all four supported placeholders", () => {
    expect(renderMergeFields("{{firstName}} {{lastName}}, {{title}} at {{companyName}}", contact)).toBe(
      "Jane Doe, CTO at Acme",
    );
  });

  it("tolerates whitespace inside the braces", () => {
    expect(renderMergeFields("Hi {{ firstName }} and {{  lastName}}", contact)).toBe("Hi Jane and Doe");
  });

  it("replaces every occurrence", () => {
    expect(renderMergeFields("{{firstName}}, {{firstName}}!", contact)).toBe("Jane, Jane!");
  });

  it("renders missing optional fields as empty rather than leaving the placeholder", () => {
    expect(renderMergeFields("[{{title}}][{{companyName}}]", { firstName: "J", lastName: "D" })).toBe("[][]");
    expect(renderMergeFields("[{{title}}][{{companyName}}]", { firstName: "J", lastName: "D", title: null, companyName: null })).toBe("[][]");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(renderMergeFields("Hi {{nickname}}", contact)).toBe("Hi {{nickname}}");
  });

  it("does not re-expand placeholders that appear inside a value", () => {
    expect(renderMergeFields("{{firstName}}", { ...contact, firstName: "{{lastName}}" })).toBe("{{lastName}}");
  });

  it("leaves text without placeholders alone", () => {
    expect(renderMergeFields("No fields here", contact)).toBe("No fields here");
  });
});

describe("isHtmlBody", () => {
  it.each(["<p>Hi</p>", "<div>x</div>", "line<br>break", "<TABLE></TABLE>", "<h1>T</h1>", "<ul><li>a</li></ul>", "<blockquote>q</blockquote>"])(
    "treats %j as HTML",
    (body) => expect(isHtmlBody(body)).toBe(true),
  );

  it.each(["plain text", 'see <a href="x">link</a>', '<img src="logo.png">', "a < b and c > d"])(
    "treats %j as plain text",
    (body) => expect(isHtmlBody(body)).toBe(false),
  );
});

describe("toEmailHtml", () => {
  it("passes HTML bodies through untouched", () => {
    const html = "<p>Already <b>HTML</b> & fine</p>";
    expect(toEmailHtml(html)).toBe(html);
  });

  it("splits blank lines into paragraphs and single newlines into <br />", () => {
    expect(toEmailHtml("One\nTwo\n\nThree")).toBe(
      '<p style="margin:0 0 1em 0">One<br />Two</p>\n<p style="margin:0 0 1em 0">Three</p>',
    );
  });

  it("escapes bare ampersands but not existing entities", () => {
    expect(toEmailHtml("R&D &amp; sales &#39;ok&#39;")).toContain("R&amp;D &amp; sales &#39;ok&#39;");
  });

  it("keeps pasted inline tags like <a> and <img> rather than escaping them", () => {
    expect(toEmailHtml('Visit <a href="https://x.com">us</a>')).toContain('<a href="https://x.com">us</a>');
  });
});

describe("composeEmailHtml", () => {
  it("returns just the body when there is no signature", () => {
    expect(composeEmailHtml("Hi")).toBe(toEmailHtml("Hi"));
    expect(composeEmailHtml("Hi", null)).toBe(toEmailHtml("Hi"));
    expect(composeEmailHtml("Hi", "   ")).toBe(toEmailHtml("Hi"));
  });

  it("appends a trimmed signature without mangling its HTML", () => {
    const out = composeEmailHtml("Hi", "  <table><tr><td>Sam</td></tr></table>  ");
    expect(out.endsWith('<div style="margin-top:1.5em"><table><tr><td>Sam</td></tr></table></div>')).toBe(true);
  });
});

describe("rewriteLinksForTracking", () => {
  const base = "https://crm.test/api/tracking/click/bulk/r1";

  it("routes http(s) links through the tracker with the destination encoded", () => {
    const out = rewriteLinksForTracking('<a href="https://acme.com/a?b=1&c=2">x</a>', base);
    expect(out).toBe(`<a href="${base}?url=${encodeURIComponent("https://acme.com/a?b=1&c=2")}">x</a>`);
  });

  it("handles http and rewrites every link", () => {
    const out = rewriteLinksForTracking('<a href="http://a.com">1</a><a href="https://b.com">2</a>', base);
    expect(out.match(/tracking\/click/g)).toHaveLength(2);
  });

  it.each(["mailto:a@b.com", "tel:+15551234567", "#section", "/relative/path"])("leaves %s alone", (url) => {
    const html = `<a href="${url}">x</a>`;
    expect(rewriteLinksForTracking(html, base)).toBe(html);
  });

  it("is case-insensitive about the href attribute and scheme", () => {
    expect(rewriteLinksForTracking('<a HREF="HTTPS://acme.com">x</a>', base)).toContain(base);
  });
});

describe("appendTrackingFooter", () => {
  const out = appendTrackingFooter("<p>Body</p>", {
    unsubscribeUrl: "https://crm.test/unsubscribe?email=a",
    trackingUrl: "https://crm.test/api/tracking/open/bulk/r1",
  });

  it("keeps the body first", () => {
    expect(out.startsWith("<p>Body</p>")).toBe(true);
  });
  it("adds an unsubscribe link", () => {
    expect(out).toContain('<a href="https://crm.test/unsubscribe?email=a">Unsubscribe</a>');
  });
  it("adds a hidden 1x1 open-tracking pixel", () => {
    expect(out).toContain('<img src="https://crm.test/api/tracking/open/bulk/r1" width="1" height="1" style="display:none" alt="" />');
  });
});

describe("unsubscribe tokens", () => {
  const original = process.env.APP_ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = "k".repeat(64);
  });
  afterAll(() => {
    if (original === undefined) delete process.env.APP_ENCRYPTION_KEY;
    else process.env.APP_ENCRYPTION_KEY = original;
  });

  it("verifies a token generated for the same email", () => {
    expect(verifyUnsubscribeToken("jane@acme.com", generateUnsubscribeToken("jane@acme.com"))).toBe(true);
  });

  it("is case- and whitespace-insensitive about the email", () => {
    expect(verifyUnsubscribeToken("  JANE@Acme.com ", generateUnsubscribeToken("jane@acme.com"))).toBe(true);
  });

  it("rejects a token for a different email", () => {
    expect(verifyUnsubscribeToken("bob@acme.com", generateUnsubscribeToken("jane@acme.com"))).toBe(false);
  });

  it("rejects tampered, empty and wrong-length tokens", () => {
    const token = generateUnsubscribeToken("jane@acme.com");
    const tampered = (token[0] === "0" ? "1" : "0") + token.slice(1);
    expect(verifyUnsubscribeToken("jane@acme.com", tampered)).toBe(false);
    expect(verifyUnsubscribeToken("jane@acme.com", "")).toBe(false);
    expect(verifyUnsubscribeToken("jane@acme.com", "abcd")).toBe(false);
  });

  it("rejects tokens made with a different secret", () => {
    const token = generateUnsubscribeToken("jane@acme.com");
    process.env.APP_ENCRYPTION_KEY = "z".repeat(64);
    expect(verifyUnsubscribeToken("jane@acme.com", token)).toBe(false);
  });

  it("refuses to run without the secret", () => {
    delete process.env.APP_ENCRYPTION_KEY;
    expect(() => generateUnsubscribeToken("a@b.com")).toThrow(/APP_ENCRYPTION_KEY/);
  });

  it("builds a link with an encoded email, the token, and no double slash", () => {
    const url = buildUnsubscribeUrl("jane+test@acme.com", "https://crm.test/");
    const token = generateUnsubscribeToken("jane+test@acme.com");
    expect(url).toBe(`https://crm.test/unsubscribe?email=jane%2Btest%40acme.com&token=${token}`);
  });
});

describe("followUpColdSince", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-10T12:00:00Z"));
  });
  afterEach(() => jest.useRealTimers());

  it("defaults to three days ago", () => {
    expect(FOLLOW_UP_COLD_DAYS).toBe(3);
    expect(followUpColdSince()).toEqual(new Date("2026-10-07T12:00:00Z"));
  });

  it("accepts a custom number of days", () => {
    expect(followUpColdSince(1)).toEqual(new Date("2026-10-09T12:00:00Z"));
  });
});
