import { validate } from "class-validator";
import { CreateBulkEmailDto } from "./create-bulk-email.dto";

const UUID = "3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f";

async function errorsFor(input: Record<string, unknown>) {
  const dto = Object.assign(new CreateBulkEmailDto(), input);
  const errors = await validate(dto);
  return errors.map((e) => e.property).sort();
}

describe("CreateBulkEmailDto", () => {
  it("accepts a minimal campaign (just a name)", async () => {
    expect(await errorsFor({ name: "Spring push" })).toEqual([]);
  });

  it("accepts a fully populated inline campaign", async () => {
    expect(
      await errorsFor({
        name: "Spring push",
        subject: "Hi {{firstName}}",
        bodyHtml: "Hello",
        appendSignature: true,
        contactIds: [UUID],
        rawEmails: ["a@x.com", "b@y.org"],
        followUpMode: "MANUAL",
      }),
    ).toEqual([]);
  });

  it("accepts a template-based campaign", async () => {
    expect(await errorsFor({ name: "N", templateId: UUID, rawEmails: ["a@x.com"] })).toEqual([]);
  });

  describe("name", () => {
    it("is required", async () => {
      expect(await errorsFor({})).toEqual(["name"]);
    });
    it("cannot be empty", async () => {
      expect(await errorsFor({ name: "" })).toEqual(["name"]);
    });
    it("is capped at 150 characters", async () => {
      expect(await errorsFor({ name: "x".repeat(150) })).toEqual([]);
      expect(await errorsFor({ name: "x".repeat(151) })).toEqual(["name"]);
    });
  });

  describe("subject / body", () => {
    it("caps the subject at 300 characters", async () => {
      expect(await errorsFor({ name: "N", subject: "s".repeat(300), bodyHtml: "b" })).toEqual([]);
      expect(await errorsFor({ name: "N", subject: "s".repeat(301), bodyHtml: "b" })).toEqual(["subject"]);
    });
    it("rejects an empty subject or body string", async () => {
      expect(await errorsFor({ name: "N", subject: "", bodyHtml: "" })).toEqual(["bodyHtml", "subject"]);
    });
  });

  describe("templateId", () => {
    it("must be a UUID", async () => {
      expect(await errorsFor({ name: "N", templateId: "not-a-uuid" })).toEqual(["templateId"]);
    });
  });

  describe("contactIds", () => {
    it("must be an array of UUIDs", async () => {
      expect(await errorsFor({ name: "N", contactIds: ["nope"] })).toEqual(["contactIds"]);
      expect(await errorsFor({ name: "N", contactIds: UUID })).toEqual(["contactIds"]);
    });
  });

  describe("rawEmails", () => {
    it("rejects malformed addresses", async () => {
      expect(await errorsFor({ name: "N", rawEmails: ["a@x.com", "not-an-email"] })).toEqual(["rawEmails"]);
    });
    it("allows up to 5000 addresses and rejects more", async () => {
      const make = (n: number) => Array.from({ length: n }, (_, i) => `u${i}@x.com`);
      expect(await errorsFor({ name: "N", rawEmails: make(5000) })).toEqual([]);
      expect(await errorsFor({ name: "N", rawEmails: make(5001) })).toEqual(["rawEmails"]);
    });
  });

  describe("appendSignature / followUpMode", () => {
    it("appendSignature must be a boolean", async () => {
      expect(await errorsFor({ name: "N", appendSignature: "yes" })).toEqual(["appendSignature"]);
    });
    it.each(["MANUAL", "ASSISTED", "AUTOMATED"])("accepts followUpMode %s", async (mode) => {
      expect(await errorsFor({ name: "N", followUpMode: mode })).toEqual([]);
    });
    it("rejects an unknown followUpMode", async () => {
      expect(await errorsFor({ name: "N", followUpMode: "SPAM_EVERYONE" })).toEqual(["followUpMode"]);
    });
  });
});
