import { BadGatewayException, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Readable } from "node:stream";
import { BunnyStorageService } from "./bunny-storage.service";

describe("BunnyStorageService Unit Tests", () => {
  let service: BunnyStorageService;
  let configService: { get: jest.Mock };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string) => {
        if (key === "BUNNY_STORAGE_ZONE") return "crm-test-zone";
        if (key === "BUNNY_STORAGE_API_KEY") return "secret-api-key";
        if (key === "BUNNY_STORAGE_HOSTNAME") return "storage.bunnycdn.com";
        if (key === "BUNNY_STORAGE_BASE_PATH") return "screen-recordings";
        return null;
      }),
    };

    service = new BunnyStorageService(configService as unknown as ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("1. Configuration & Path Generation", () => {
    it("reports isConfigured true when zone and api key are present", () => {
      expect(service.isConfigured()).toBe(true);
    });

    it("reports isConfigured false when credentials are missing", () => {
      configService.get.mockReturnValue("");
      expect(service.isConfigured()).toBe(false);
    });

    it("builds deterministic storage paths in YYYY/MM/DD/employee-{userId}/{id}.webm format", () => {
      const fixedDate = new Date("2026-10-02T15:30:00Z");
      const path = service.buildPath("user-456", "rec-789", fixedDate);
      expect(path).toBe("screen-recordings/2026/10/02/employee-user-456/rec-789.webm");
    });
  });

  describe("2. Upload Operation", () => {
    it("successfully sends PUT request to Bunny Storage with AccessKey header", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: jest.fn().mockResolvedValue("File uploaded."),
      });
      global.fetch = mockFetch;

      const bodyStream = Readable.from(["video-bytes"]);
      const res = await service.upload("test/path.webm", bodyStream, "video/webm", 100);

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://storage.bunnycdn.com/crm-test-zone/test/path.webm",
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            AccessKey: "secret-api-key",
            "Content-Type": "video/webm",
            "Content-Length": "100",
          }),
        }),
      );
    });

    it("throws BadGatewayException when Bunny Storage returns an error status", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue("Internal Bunny Error"),
      });
      global.fetch = mockFetch;

      await expect(
        service.upload("test/path.webm", Buffer.from("data"), "video/webm", 4),
      ).rejects.toThrow(BadGatewayException);
    });

    it("throws InternalServerErrorException when not configured", async () => {
      configService.get.mockReturnValue("");
      await expect(
        service.upload("test/path.webm", Buffer.from("data")),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe("3. Get & Range Streaming", () => {
    it("requests with Range header and returns stream when range specified", async () => {
      const webStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("stream-data"));
          controller.close();
        },
      });

      const mockHeaders = new Headers({
        "content-type": "video/webm",
        "content-length": "100",
        "content-range": "bytes 0-99/500",
        "accept-ranges": "bytes",
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 206,
        headers: mockHeaders,
        body: webStream,
      });
      global.fetch = mockFetch;

      const result = await service.get("test/path.webm", { start: 0, end: 99 });
      expect(result.status).toBe(206);
      expect(result.headers.contentRange).toBe("bytes 0-99/500");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://storage.bunnycdn.com/crm-test-zone/test/path.webm",
        expect.objectContaining({
          headers: expect.objectContaining({
            AccessKey: "secret-api-key",
            Range: "bytes=0-99",
          }),
        }),
      );
    });

    it("throws NotFoundException when file not found on Bunny (404)", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
      });

      await expect(service.get("non-existent.webm")).rejects.toThrow(NotFoundException);
    });
  });

  describe("4. Delete & Exists Operations", () => {
    it("sends DELETE request with AccessKey", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const deleted = await service.delete("test/path.webm");
      expect(deleted).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://storage.bunnycdn.com/crm-test-zone/test/path.webm",
        expect.objectContaining({
          method: "DELETE",
          headers: { AccessKey: "secret-api-key" },
        }),
      );
    });

    it("sends HEAD request to check file existence", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        status: 200,
      });
      global.fetch = mockFetch;

      const exists = await service.exists("test/path.webm");
      expect(exists).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://storage.bunnycdn.com/crm-test-zone/test/path.webm",
        expect.objectContaining({
          method: "HEAD",
          headers: { AccessKey: "secret-api-key" },
        }),
      );
    });
  });
});
