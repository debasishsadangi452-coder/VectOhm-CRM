import { parseIntentAnalysis, tierFor } from "./intent-news-ai";
import { parseRssItems } from "./intent-news-sources";

describe("parseRssItems", () => {
  it("reads Google News items and strips the publisher suffix", () => {
    const xml = `<rss><channel><title>feed</title>
      <item><title>Acme selects SAP S/4HANA &amp; Joule - Reuters</title>
        <link>https://news.google.com/rss/articles/abc</link>
        <pubDate>Tue, 21 Oct 2026 10:00:00 GMT</pubDate>
        <source url="https://www.reuters.com">Reuters</source></item>
      <item><title><![CDATA[Beta raises $40M Series B]]></title><link>https://x.test/b</link></item>
      <item><title>no link</title></item>
    </channel></rss>`;
    const items = parseRssItems(xml);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: "Acme selects SAP S/4HANA & Joule",
      link: "https://news.google.com/rss/articles/abc",
      publishedAt: "2026-10-21T10:00:00.000Z",
      sourceName: "Reuters",
      sourceDomain: "reuters.com",
    });
    expect(items[1].title).toBe("Beta raises $40M Series B");
    expect(items[1].sourceDomain).toBeNull();
  });
});

describe("parseIntentAnalysis", () => {
  it("maps results by index, clamps scores and cleans domains", () => {
    const text = '```json\n{"results":[{"i":1,"relevant":true,"signalType":"ERP_AI","intentScore":140,"companyName":"Acme","companyDomain":"https://www.Acme.com/news","erpVendors":["SAP"],"targetedRoles":["CIO"]},{"i":7,"relevant":true}]}\n```';
    const out = parseIntentAnalysis(text, 2);
    expect(out[0]).toBeNull();
    expect(out[1]).toMatchObject({ relevant: true, signalType: "ERP_AI", intentScore: 100, companyName: "Acme", companyDomain: "acme.com", erpVendors: ["SAP"], aiKeywords: [] });
    expect(tierFor(out[1]!)).toBe("ERP_AI_VIP");
  });

  it("returns all nulls on junk and defaults unknown signal types", () => {
    expect(parseIntentAnalysis("not json", 2)).toEqual([null, null]);
    const [r] = parseIntentAnalysis('{"results":[{"i":0,"relevant":false,"signalType":"WEIRD","intentScore":"x","companyName":"null"}]}', 1);
    expect(r).toMatchObject({ signalType: "OTHER", intentScore: 0, companyName: null });
    expect(tierFor(r!)).toBe("STANDARD_GROWTH");
  });
});
