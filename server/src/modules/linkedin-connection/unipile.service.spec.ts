import { UnipileService } from "./unipile.service";

describe("UnipileService - extractPublicIdentifier", () => {
  let service: UnipileService;

  beforeEach(() => {
    service = new UnipileService();
  });

  it("extracts public identifier from URL without protocol starting with www", () => {
    expect(
      service.extractPublicIdentifier("www.linkedin.com/in/pratyush-kumar-sethi-71a919380"),
    ).toBe("pratyush-kumar-sethi-71a919380");
  });

  it("extracts public identifier from full https URL with trailing slash", () => {
    expect(
      service.extractPublicIdentifier("https://www.linkedin.com/in/pratyush-kumar-sethi-71a919380/"),
    ).toBe("pratyush-kumar-sethi-71a919380");
  });

  it("extracts public identifier from URL without protocol or www", () => {
    expect(
      service.extractPublicIdentifier("linkedin.com/in/pratyush-kumar-sethi-71a919380"),
    ).toBe("pratyush-kumar-sethi-71a919380");
  });

  it("extracts public identifier when query parameters are present", () => {
    expect(
      service.extractPublicIdentifier(
        "www.linkedin.com/in/pratyush-kumar-sethi-71a919380?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3A123",
      ),
    ).toBe("pratyush-kumar-sethi-71a919380");
  });

  it("extracts public identifier from raw vanity username", () => {
    expect(service.extractPublicIdentifier("pratyush-kumar-sethi-71a919380")).toBe(
      "pratyush-kumar-sethi-71a919380",
    );
  });

  it("returns empty string for empty input", () => {
    expect(service.extractPublicIdentifier("")).toBe("");
  });
});
