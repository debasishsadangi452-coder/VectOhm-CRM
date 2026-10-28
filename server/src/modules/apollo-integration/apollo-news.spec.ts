import { BadRequestException } from "@nestjs/common";
import { ApolloService } from "./apollo.service";

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

const article = (n: number, orgId = "o1") => ({
  id: `a${n}`,
  title: `Headline ${n}`,
  url: `https://n.example/${n}`,
  published_at: `2026-10-${String((n % 28) + 1).padStart(2, "0")}`,
  organization_id: orgId,
});

describe("ApolloService.searchNewsOrganizations", () => {
  let service: ApolloService;
  let fetchMock: jest.Mock;
  const realFetch = global.fetch;

  beforeEach(() => {
    service = new ApolloService({} as any, { requireApiKey: jest.fn().mockResolvedValue("key") } as any);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  const filters = { keywords: "saas", daysBack: 30, candidateCount: 10 };
  const orgSearch = () => json({ organizations: [{ id: "o1", name: "Acme", primary_domain: "acme.com" }] });
  const newsBodies = () =>
    fetchMock.mock.calls
      .filter(([url]) => String(url).includes("news_articles"))
      .map(([, init]) => JSON.parse(init.body));

  it("never asks Apollo for more than 25 articles per page (a larger per_page is a 422)", async () => {
    fetchMock.mockImplementationOnce(orgSearch).mockImplementationOnce(() => json({ news_articles: [article(1)] }));
    await service.searchNewsOrganizations(filters);
    expect(newsBodies().every((b) => b.per_page <= 25)).toBe(true);
  });

  it("pages through full pages and stops at the first short one", async () => {
    fetchMock
      .mockImplementationOnce(orgSearch)
      .mockImplementationOnce(() => json({ news_articles: Array.from({ length: 25 }, (_, i) => article(i)) }))
      .mockImplementationOnce(() => json({ news_articles: [article(99)] }));
    const res = await service.searchNewsOrganizations(filters);
    expect(newsBodies().map((b) => b.page)).toEqual([1, 2]);
    expect(res.organizations).toHaveLength(1);
    expect(res.organizations[0].articles).toHaveLength(26);
    expect(res).toMatchObject({ candidatesChecked: 1, articlesFound: 26 });
  });

  it("caps the number of pages", async () => {
    fetchMock.mockImplementationOnce(orgSearch);
    fetchMock.mockImplementation(() => json({ news_articles: Array.from({ length: 25 }, (_, i) => article(i)) }));
    await service.searchNewsOrganizations(filters);
    expect(newsBodies()).toHaveLength(4);
  });

  it("looks up news in batches of 10 organisations and pages candidates", async () => {
    const orgs = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `o${from + i}`, name: `Org${from + i}`, primary_domain: `o${from + i}.com` }));
    fetchMock
      .mockImplementationOnce(() => json({ organizations: orgs(0, 20) }))
      .mockImplementation(() => json({ news_articles: [] }));
    const res = await service.searchNewsOrganizations({ ...filters, candidateCount: 20 });
    expect(res.candidatesChecked).toBe(20);
    const batches = newsBodies().map((b) => b.organization_ids.length);
    expect(batches).toEqual([10, 10]);
  });

  it("surfaces Apollo's error instead of returning fake data", async () => {
    fetchMock
      .mockImplementationOnce(orgSearch)
      .mockImplementationOnce(() => json({ error: "nope" }, 403));
    await expect(service.searchNewsOrganizations(filters)).rejects.toThrow(BadRequestException);
  });
});
