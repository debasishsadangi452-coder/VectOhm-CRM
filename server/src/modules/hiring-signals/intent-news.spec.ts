import { ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { classifyNews } from "./news-signal.util";
import { HiringSignalsDiscoveryService } from "./hiring-signals-discovery.service";
import type { RequestUser } from "../../common/types/request-user.type";

const user = (dept: string, role: RoleName = RoleName.EMPLOYEE): RequestUser =>
  ({
    id: "u1",
    email: "u@x.com",
    firstName: "U",
    lastName: "T",
    role: { id: "r", name: role },
    department: { id: "d", name: dept, managerTitle: "L" },
  }) as RequestUser;

describe("classifyNews", () => {
  it.each([
    ["Acme raises $20M Series B to expand in Europe", ["FUNDING", "EXPANSION"]],
    ["Globex appoints new CTO", ["LEADERSHIP"]],
    ["Initech unveils new analytics product", ["PRODUCT"]],
    ["Hooli to acquire Pied Piper in partnership deal", ["PARTNERSHIP"]],
  ])("%s", (text, expected) => {
    expect(classifyNews(text)).toEqual(expect.arrayContaining(expected as never[]));
  });

  it("returns nothing for unrelated headlines", () => {
    expect(classifyNews("Weather report for the weekend")).toEqual([]);
  });
});

describe("HiringSignalsDiscoveryService.searchIntentNews", () => {
  const org = (id: string, name: string) => ({
    apolloId: id,
    name,
    domain: `${name.toLowerCase()}.com`,
    employeeCount: 50,
    headcountGrowth6mo: null,
    headcountGrowth12mo: null,
  });
  const article = (id: string, title: string) => ({
    id,
    title,
    url: `https://news.example/${id}`,
    publishedAt: "2026-10-01",
    snippet: null,
    labels: [],
  });

  let apollo: any;
  let service: HiringSignalsDiscoveryService;

  beforeEach(() => {
    apollo = {
      searchNewsOrganizations: jest.fn().mockResolvedValue({
        candidatesChecked: 3,
        articlesFound: 4,
        organizations: [
          { organization: org("o1", "Acme"), articles: [article("a1", "Acme raises Series A"), article("a2", "Acme hosts picnic")] },
          { organization: org("o2", "Globex"), articles: [article("a3", "Globex appoints new CTO")] },
          { organization: org("o3", "Initech"), articles: [article("a4", "Initech weather update")] },
        ],
      }),
      findDecisionMakersForCompany: jest.fn().mockImplementation(async (name: string) =>
        name === "Acme"
          ? { apolloId: "p1", name: "Ann Lee", firstName: "Ann", lastName: "Lee", title: "CEO", email: "ann@acme.com", linkedinUrl: null }
          : null,
      ),
    };
    service = new HiringSignalsDiscoveryService(
      {} as any, apollo, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );
  });

  it("is limited to Recruitment, Sales and Admin", async () => {
    await expect(service.searchIntentNews({ keywords: "saas" }, user("Marketing"))).rejects.toThrow(ForbiddenException);
    await expect(service.searchIntentNews({ keywords: "saas" }, user("Sales"))).resolves.toBeDefined();
    await expect(service.searchIntentNews({ keywords: "saas" }, user("Whatever", RoleName.ADMIN))).resolves.toBeDefined();
  });

  it("with any signal, returns every company with news (unrecognised headlines as Company news), named signals first", async () => {
    const res = await service.searchIntentNews({ keywords: "saas" }, user("Recruitment"));
    expect(res.leads.map((l) => l.companyName)).toEqual(["Acme", "Globex", "Initech"]);
    expect(res.leads[0]).toMatchObject({
      jobTitle: "Acme raises Series A",
      source: "APOLLO_NEWS",
      newsCategory: "FUNDING",
      decisionMaker: { name: "Ann Lee", email: "ann@acme.com" },
    });
    expect(res.leads[0].newsArticles).toEqual([expect.objectContaining({ title: "Acme hosts picnic", category: "OTHER" })]);
    expect(res.leads[1].decisionMaker).toBeNull();
    expect(res.leads[2]).toMatchObject({ newsCategory: "OTHER", newsCategoryLabel: "Company news" });
    expect(res).toMatchObject({ candidatesChecked: 3, articlesFound: 4 });
  });

  it("filters to the requested category", async () => {
    const res = await service.searchIntentNews({ keywords: "saas", category: "LEADERSHIP" }, user("Sales"));
    expect(res.leads.map((l) => l.companyName)).toEqual(["Globex"]);
  });

  it("respects maxResults and survives a failing decision-maker lookup", async () => {
    apollo.findDecisionMakersForCompany.mockRejectedValue(new Error("boom"));
    const res = await service.searchIntentNews({ keywords: "saas", maxResults: 1 }, user("Sales"));
    expect(res.leads).toHaveLength(1);
    expect(res.leads[0].decisionMaker).toBeNull();
  });

  it("returns no leads (never fabricated ones) when Apollo has no news", async () => {
    apollo.searchNewsOrganizations.mockResolvedValue({ organizations: [], candidatesChecked: 40, articlesFound: 0 });
    const res = await service.searchIntentNews({ keywords: "saas" }, user("Sales"));
    expect(res).toMatchObject({ totalFound: 0, leads: [], candidatesChecked: 40, articlesFound: 0 });
  });
});
