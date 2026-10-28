import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { Readable } from "node:stream";
import { ScreenRecordingsService, formatRecordingFilename, parseRange } from "./screen-recordings.service";
import type { RequestUser } from "../../common/types/request-user.type";

jest.mock("node:fs", () => ({
  ...jest.requireActual("node:fs"),
  createReadStream: jest.fn(() => Readable.from(["mock-video-chunk"])),
}));

function buildPrismaMock() {
  return {
    screenRecording: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };
}

function buildUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: "user-sales-1",
    email: "sales1@company.com",
    firstName: "Alice",
    lastName: "Sales",
    role: { id: "role-emp", name: RoleName.EMPLOYEE },
    department: { id: "dept-sales", name: "Sales", managerTitle: "Sales Lead" },
    ...overrides,
  };
}

const adminUser = () =>
  buildUser({
    id: "admin-1",
    email: "admin@company.com",
    role: { id: "role-admin", name: RoleName.ADMIN },
    department: null,
  });

const hrUser = () =>
  buildUser({
    id: "hr-1",
    email: "hr@company.com",
    role: { id: "role-hr", name: RoleName.EMPLOYEE },
    department: { id: "dept-hr", name: "HR", managerTitle: "HR Head" },
  });

const salesManager = () =>
  buildUser({
    id: "mgr-sales-1",
    email: "mgr-sales@company.com",
    role: { id: "role-mgr", name: RoleName.MANAGER },
    department: { id: "dept-sales", name: "Sales", managerTitle: "Sales Lead" },
  });

const devManager = () =>
  buildUser({
    id: "mgr-dev-1",
    email: "mgr-dev@company.com",
    role: { id: "role-mgr", name: RoleName.MANAGER },
    department: { id: "dept-dev", name: "Dev", managerTitle: "Dev Lead" },
  });

const salesEmployee = (id = "user-sales-1") =>
  buildUser({
    id,
    email: `${id}@company.com`,
    role: { id: "role-emp", name: RoleName.EMPLOYEE },
    department: { id: "dept-sales", name: "Sales", managerTitle: "Sales Lead" },
  });

describe("ScreenRecordingsService — Bunny Storage Integration Tests", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let workSessions: { getActive: jest.Mock };
  let localStorageService: {
    multerStorage: jest.Mock;
    exists: jest.Mock;
    size: jest.Mock;
    stream: jest.Mock;
    delete: jest.Mock;
    cleanupTemp: jest.Mock;
  };
  let bunnyStorageService: {
    isConfigured: jest.Mock;
    buildPath: jest.Mock;
    upload: jest.Mock;
    get: jest.Mock;
    download: jest.Mock;
    delete: jest.Mock;
    exists: jest.Mock;
  };
  let service: ScreenRecordingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = buildPrismaMock();
    workSessions = {
      getActive: jest.fn(),
    };
    localStorageService = {
      multerStorage: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      size: jest.fn().mockResolvedValue(1024),
      stream: jest.fn().mockReturnValue(Readable.from(["chunk"])),
      delete: jest.fn().mockResolvedValue(undefined),
      cleanupTemp: jest.fn().mockResolvedValue(undefined),
    };
    bunnyStorageService = {
      isConfigured: jest.fn().mockReturnValue(true),
      buildPath: jest
        .fn()
        .mockReturnValue("screen-recordings/2026/10/02/employee-user-sales-1/rec-123.webm"),
      upload: jest.fn().mockResolvedValue({ success: true, sizeBytes: 5000 }),
      get: jest.fn().mockResolvedValue({
        status: 200,
        headers: { contentType: "video/webm", contentLength: 5000, acceptRanges: "bytes" },
        stream: Readable.from(["bunny-video-stream"]),
      }),
      download: jest.fn().mockResolvedValue({
        status: 200,
        headers: { contentType: "video/webm", contentLength: 5000 },
        stream: Readable.from(["bunny-video-download"]),
      }),
      delete: jest.fn().mockResolvedValue(true),
      exists: jest.fn().mockResolvedValue(true),
    };

    /* eslint-disable @typescript-eslint/no-explicit-any -- partial jest mocks, not the real class shapes */
    service = new ScreenRecordingsService(
      prisma as any,
      workSessions as any,
      localStorageService as any,
      bunnyStorageService as any,
    );
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });

  describe("1. Upload to Bunny Storage", () => {
    const mockFile: Express.Multer.File = {
      fieldname: "file",
      originalname: "clip.webm",
      encoding: "7bit",
      mimetype: "video/webm",
      size: 5000,
      destination: "/tmp",
      filename: "rec-tmp-123.webm",
      path: "/tmp/rec-tmp-123.webm",
      buffer: Buffer.from("fake-video-content"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Readable doesn't satisfy Multer.File's stream type, mock-only
      stream: Readable.from(["fake-video-content"]) as any,
    };

    it("Uploads to Bunny Storage and creates DB record when employee is clocked in", async () => {
      workSessions.getActive.mockResolvedValue({ id: "ws-active-1", isOnBreak: false });
      prisma.screenRecording.create.mockImplementation(({ data }) =>
        Promise.resolve({ ...data, createdAt: new Date() }),
      );

      const res = await service.create(salesEmployee(), mockFile, 180);

      expect(res.id).toBeDefined();
      expect(bunnyStorageService.buildPath).toHaveBeenCalledWith(
        "user-sales-1",
        expect.any(String),
        expect.any(Date),
      );
      expect(bunnyStorageService.upload).toHaveBeenCalledTimes(1);
      expect(prisma.screenRecording.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-sales-1",
          workSessionId: "ws-active-1",
          storageProvider: "BUNNY",
          uploadStatus: "UPLOADED",
          sizeBytes: 5000,
          durationSec: 180,
        }),
      });
      // Local temp file must be unlinked
      expect(localStorageService.cleanupTemp).toHaveBeenCalledWith("/tmp/rec-tmp-123.webm");
    });

    it("Refuses (403) and uploads nothing for an account with recording turned off", async () => {
      prisma.user.findUnique.mockResolvedValue({ screenRecordingEnabled: false });
      await expect(service.create(salesEmployee(), mockFile, 180)).rejects.toThrow(ForbiddenException);
      expect(bunnyStorageService.upload).not.toHaveBeenCalled();
      expect(prisma.screenRecording.create).not.toHaveBeenCalled();
      expect(localStorageService.cleanupTemp).toHaveBeenCalledWith("/tmp/rec-tmp-123.webm"); // temp file still removed
    });

    it("Records employees in any department, or with no department", async () => {
      workSessions.getActive.mockResolvedValue({ id: "ws-active-1", isOnBreak: false });
      prisma.screenRecording.create.mockResolvedValue({ id: "rec-any", startedAt: new Date() });
      const devEmp = buildUser({ department: { id: "dept-dev", name: "Dev", managerTitle: "Dev Lead" } });
      await service.create(devEmp, mockFile, 180);
      await service.create(buildUser({ department: null }), mockFile, 180);
      expect(bunnyStorageService.upload).toHaveBeenCalledTimes(2);
      expect(prisma.screenRecording.create).toHaveBeenCalledTimes(2);
    });

    it("Accepts a clip when the employee is not clocked in, stored without a work session", async () => {
      workSessions.getActive.mockResolvedValue(null);
      prisma.screenRecording.create.mockResolvedValue({ id: "rec-off", startedAt: new Date() });
      await service.create(salesEmployee(), mockFile, 180);
      expect(bunnyStorageService.upload).toHaveBeenCalledTimes(1);
      expect(prisma.screenRecording.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "user-sales-1", workSessionId: null }),
      });
      expect(localStorageService.cleanupTemp).toHaveBeenCalledWith("/tmp/rec-tmp-123.webm");
    });

    it("Accepts a clip during a break, linked to the open work session", async () => {
      workSessions.getActive.mockResolvedValue({ id: "ws-break", isOnBreak: true });
      prisma.screenRecording.create.mockResolvedValue({ id: "rec-break", startedAt: new Date() });
      await service.create(salesEmployee(), mockFile, 180);
      expect(bunnyStorageService.upload).toHaveBeenCalledTimes(1);
      expect(prisma.screenRecording.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ workSessionId: "ws-break" }),
      });
    });

    it("Uploads a JPEG thumbnail next to the clip and stores its path", async () => {
      workSessions.getActive.mockResolvedValue(null);
      prisma.screenRecording.create.mockResolvedValue({ id: "rec-thumb", startedAt: new Date() });
      const thumb = { ...mockFile, path: "/tmp/rec-tmp-thumb", mimetype: "image/jpeg", size: 20_000 };

      await service.create(salesEmployee(), mockFile, 180, thumb);

      expect(bunnyStorageService.upload).toHaveBeenCalledTimes(2);
      const thumbPath = bunnyStorageService.upload.mock.calls[1][0];
      expect(thumbPath).toMatch(/\.jpg$/);
      expect(prisma.screenRecording.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ thumbnailPath: thumbPath }),
      });
      expect(localStorageService.cleanupTemp).toHaveBeenCalledWith("/tmp/rec-tmp-thumb");
    });

    it("Keeps the clip when the thumbnail upload fails, and ignores non-JPEG thumbnails", async () => {
      workSessions.getActive.mockResolvedValue(null);
      prisma.screenRecording.create.mockResolvedValue({ id: "rec-thumb", startedAt: new Date() });
      bunnyStorageService.upload
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("thumb failed"));
      const thumb = { ...mockFile, path: "/tmp/rec-tmp-thumb", mimetype: "image/jpeg", size: 20_000 };

      await service.create(salesEmployee(), mockFile, 180, thumb);
      expect(prisma.screenRecording.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({ thumbnailPath: null }),
      });

      bunnyStorageService.upload.mockClear();
      await service.create(salesEmployee(), mockFile, 180, { ...thumb, mimetype: "text/html" });
      expect(bunnyStorageService.upload).toHaveBeenCalledTimes(1);
    });

    it("Does NOT create a DB record if Bunny Storage upload fails, and cleans up local temp file", async () => {
      workSessions.getActive.mockResolvedValue({ id: "ws-active-1", isOnBreak: false });
      bunnyStorageService.upload.mockRejectedValue(new Error("Bunny connection timeout"));

      await expect(service.create(salesEmployee(), mockFile, 180)).rejects.toThrow(
        "Bunny connection timeout",
      );

      expect(prisma.screenRecording.create).not.toHaveBeenCalled();
      expect(localStorageService.cleanupTemp).toHaveBeenCalledWith("/tmp/rec-tmp-123.webm");
    });
  });

  describe("2. Playback & Range Requests", () => {
    const mockRecordingRecord = {
      id: "rec-1",
      storageProvider: "BUNNY",
      storagePath: "screen-recordings/2026/10/02/employee-user-sales-1/rec-1.webm",
      bunnyPath: "screen-recordings/2026/10/02/employee-user-sales-1/rec-1.webm",
      mimeType: "video/webm",
      sizeBytes: 10000,
      user: {
        id: "user-sales-1",
        email: "alice@company.com",
        department: { id: "dept-sales" },
      },
    };

    it("ADMIN can stream playback from Bunny Storage", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockRecordingRecord);

      const result = await service.getPlayback("rec-1", adminUser());
      expect(result.kind).toBe("stream");
      if (result.kind === "stream") {
        expect(result.status).toBe(200);
        expect(bunnyStorageService.get).toHaveBeenCalledWith(mockRecordingRecord.bunnyPath, undefined);
      }
    });

    it("HR can stream playback from Bunny Storage", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockRecordingRecord);

      const result = await service.getPlayback("rec-1", hrUser());
      expect(result.kind).toBe("stream");
      if (result.kind === "stream") {
        expect(bunnyStorageService.get).toHaveBeenCalled();
      }
    });

    it("SALES MANAGER can stream playback for employee in Sales department", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockRecordingRecord);

      const result = await service.getPlayback("rec-1", salesManager());
      expect(result.kind).toBe("stream");
      if (result.kind === "stream") {
        expect(bunnyStorageService.get).toHaveBeenCalled();
      }
    });

    it("DEV MANAGER is denied playback for Sales employee (403 Forbidden)", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockRecordingRecord);

      await expect(service.getPlayback("rec-1", devManager())).rejects.toThrow(
        new ForbiddenException("You do not have permission to view this recording"),
      );
      expect(bunnyStorageService.get).not.toHaveBeenCalled();
    });

    it("STANDARD EMPLOYEE is denied playback even for their own recording (403 Forbidden)", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockRecordingRecord);

      await expect(service.getPlayback("rec-1", salesEmployee("user-sales-1"))).rejects.toThrow(
        new ForbiddenException("You do not have permission to view this recording"),
      );
      expect(bunnyStorageService.get).not.toHaveBeenCalled();
    });

    it("Passes Range header to Bunny Storage when seeking (206 Partial Content)", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockRecordingRecord);
      bunnyStorageService.get.mockResolvedValue({
        status: 206,
        headers: {
          contentType: "video/webm",
          contentRange: "bytes 0-1023/10000",
          contentLength: 1024,
          acceptRanges: "bytes",
        },
        stream: Readable.from(["partial-content"]),
      });

      const result = await service.getPlayback("rec-1", adminUser(), "bytes=0-1023");
      expect(result.kind).toBe("stream");
      if (result.kind === "stream") {
        expect(result.status).toBe(206);
        expect(bunnyStorageService.get).toHaveBeenCalledWith(mockRecordingRecord.bunnyPath, {
          start: 0,
          end: 1023,
        });
        expect(result.headers["Content-Range"]).toBe("bytes 0-1023/10000");
      }
    });

    it("Returns unsatisfiable when Range header is beyond file size", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockRecordingRecord);

      const result = await service.getPlayback("rec-1", adminUser(), "bytes=50000-60000");
      expect(result.kind).toBe("unsatisfiable");
      if (result.kind === "unsatisfiable") {
        expect(result.size).toBe(10000);
      }
    });

    it("Falls back to local storage streaming for legacy LOCAL recordings", async () => {
      const legacyRecord = {
        ...mockRecordingRecord,
        storageProvider: "LOCAL",
        bunnyPath: null,
        storagePath: "legacy-local-clip.webm",
      };
      prisma.screenRecording.findUnique.mockResolvedValue(legacyRecord);
      localStorageService.size.mockResolvedValue(10000);

      const result = await service.getPlayback("rec-1", adminUser());
      expect(result.kind).toBe("stream");
      if (result.kind === "stream") {
        expect(localStorageService.stream).toHaveBeenCalledWith("legacy-local-clip.webm", 0, 9999);
        expect(bunnyStorageService.get).not.toHaveBeenCalled();
      }
    });
  });

  describe("3. Download Endpoint", () => {
    const mockDownloadRecord = {
      id: "rec-download-1",
      storageProvider: "BUNNY",
      storagePath: "screen-recordings/2026/10/02/employee-user-sales-1/rec-download-1.webm",
      bunnyPath: "screen-recordings/2026/10/02/employee-user-sales-1/rec-download-1.webm",
      mimeType: "video/webm",
      sizeBytes: 8192,
      startedAt: new Date("2026-10-02T14:20:00Z"),
      user: {
        id: "user-sales-1",
        email: "alice@company.com",
        firstName: "Alice",
        lastName: "Smith",
        department: { id: "dept-sales" },
      },
    };

    it("Admin can download Bunny video with formatted filename", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockDownloadRecord);

      const dl = await service.getForDownload("rec-download-1", adminUser());
      expect(dl.filename).toMatch(/^alice_smith_2026-10-02_\d{2}-\d{2}-\d{2}\.webm$/);
      expect(dl.mimeType).toBe("video/webm");
      expect(bunnyStorageService.download).toHaveBeenCalledWith(mockDownloadRecord.bunnyPath);
    });

    it("Department Manager can download recording of own department employee", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockDownloadRecord);

      const dl = await service.getForDownload("rec-download-1", salesManager());
      expect(dl.filename).toContain("alice_smith");
      expect(bunnyStorageService.download).toHaveBeenCalled();
    });

    it("Dev Manager cannot download Sales employee recording (403 Forbidden)", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockDownloadRecord);

      await expect(service.getForDownload("rec-download-1", devManager())).rejects.toThrow(
        new ForbiddenException("You do not have permission to download this recording"),
      );
      expect(bunnyStorageService.download).not.toHaveBeenCalled();
    });

    it("Standard Employee cannot download recording (403 Forbidden)", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockDownloadRecord);

      await expect(
        service.getForDownload("rec-download-1", salesEmployee("user-sales-1")),
      ).rejects.toThrow(
        new ForbiddenException("You do not have permission to download this recording"),
      );
    });
  });

  describe("4. Deletion", () => {
    const mockRec = {
      id: "rec-del",
      storageProvider: "BUNNY",
      storagePath: "screen-recordings/bunny/del.webm",
      bunnyPath: "screen-recordings/bunny/del.webm",
    };

    it("Admin can delete recording from Bunny and DB", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockRec);
      prisma.screenRecording.delete.mockResolvedValue(mockRec);

      await service.remove("rec-del", adminUser());

      expect(bunnyStorageService.delete).toHaveBeenCalledWith(mockRec.bunnyPath);
      expect(prisma.screenRecording.delete).toHaveBeenCalledWith({ where: { id: "rec-del" } });
    });

    it("HR can delete recording from Bunny and DB", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockRec);
      prisma.screenRecording.delete.mockResolvedValue(mockRec);

      await service.remove("rec-del", hrUser());

      expect(bunnyStorageService.delete).toHaveBeenCalledWith(mockRec.bunnyPath);
      expect(prisma.screenRecording.delete).toHaveBeenCalledWith({ where: { id: "rec-del" } });
    });

    it("Manager CANNOT delete recording (403 Forbidden)", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockRec);

      await expect(service.remove("rec-del", salesManager())).rejects.toThrow(
        new ForbiddenException("Only Admin or HR can delete screen recordings"),
      );
      expect(bunnyStorageService.delete).not.toHaveBeenCalled();
      expect(prisma.screenRecording.delete).not.toHaveBeenCalled();
    });

    it("Employee CANNOT delete recording (403 Forbidden)", async () => {
      prisma.screenRecording.findUnique.mockResolvedValue(mockRec);

      await expect(service.remove("rec-del", salesEmployee())).rejects.toThrow(
        new ForbiddenException("Only Admin or HR can delete screen recordings"),
      );
      expect(bunnyStorageService.delete).not.toHaveBeenCalled();
      expect(prisma.screenRecording.delete).not.toHaveBeenCalled();
    });
  });

  describe("5. Retention Sweep", () => {
    it("Deletes expired Bunny Storage objects and DB rows", async () => {
      const expiredList = [
        {
          id: "exp-1",
          storageProvider: "BUNNY",
          bunnyPath: "screen-recordings/old1.webm",
          storagePath: "screen-recordings/old1.webm",
        },
        {
          id: "exp-2",
          storageProvider: "BUNNY",
          bunnyPath: "screen-recordings/old2.webm",
          storagePath: "screen-recordings/old2.webm",
        },
      ];
      prisma.screenRecording.findMany.mockResolvedValue(expiredList);
      prisma.screenRecording.deleteMany.mockResolvedValue({ count: 2 });

      await service.sweepExpired();

      expect(bunnyStorageService.delete).toHaveBeenCalledWith("screen-recordings/old1.webm");
      expect(bunnyStorageService.delete).toHaveBeenCalledWith("screen-recordings/old2.webm");
      expect(prisma.screenRecording.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["exp-1", "exp-2"] } },
      });
    });
  });

  describe("6. Helper Utilities", () => {
    it("formatRecordingFilename sanitizes special characters", () => {
      const name = formatRecordingFilename("John/Jane*", "Doe#123", new Date("2026-10-02T14:20:05Z"));
      expect(name).toMatch(/^john_jane__doe_123_2026-10-02_\d{2}-\d{2}-\d{2}\.webm$/);
    });

    it("parseRange handles valid byte ranges", () => {
      expect(parseRange("bytes=0-100", 500)).toEqual({ start: 0, end: 100 });
      expect(parseRange("bytes=200-", 500)).toEqual({ start: 200, end: 499 });
      expect(parseRange("bytes=600-", 500)).toBe("unsatisfiable");
    });
  });
});
