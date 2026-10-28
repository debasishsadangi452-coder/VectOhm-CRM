import { isPlainOrSimpleHtml, simpleHtmlToPlainText, toEmailHtml } from "./email-body";

describe("isPlainOrSimpleHtml", () => {
  it("accepts plain text and paragraph/line-break HTML", () => {
    expect(isPlainOrSimpleHtml("Hello Jane,\n\nWe help teams hire.")).toBe(true);
    expect(isPlainOrSimpleHtml("<p>Hello</p>\n<p>Line<br />two</p>")).toBe(true);
    expect(isPlainOrSimpleHtml('<p style="margin:0 0 1em 0">Hi<br/>there</p>')).toBe(true);
  });

  it("rejects real markup the AI could damage", () => {
    expect(isPlainOrSimpleHtml('<p>See <a href="https://x.com">our site</a></p>')).toBe(false);
    expect(isPlainOrSimpleHtml('<p><img src="logo.png"></p>')).toBe(false);
    expect(isPlainOrSimpleHtml("<table><tr><td>x</td></tr></table>")).toBe(false);
    expect(isPlainOrSimpleHtml("<ul><li>one</li></ul>")).toBe(false);
    expect(isPlainOrSimpleHtml("<p>Hi <b>there</b></p>")).toBe(false);
  });
});

describe("simpleHtmlToPlainText", () => {
  it("turns paragraphs into blank-line-separated text and <br> into line breaks", () => {
    expect(simpleHtmlToPlainText("<p>Hello Jane</p>\n<p>Line one<br />Line two</p>")).toBe("Hello Jane\n\nLine one\nLine two");
  });

  it("decodes the entities our own converter writes", () => {
    expect(simpleHtmlToPlainText("<p>Q&amp;A &lt;fast&gt; &quot;now&quot;</p>")).toBe('Q&A <fast> "now"');
  });

  it("round-trips with the HTML the sender builds for plain text", () => {
    const text = "Hi Jane,\n\nWe help teams hire faster.\nWant a call?";
    expect(simpleHtmlToPlainText(toEmailHtml(text))).toBe(text);
  });
});
