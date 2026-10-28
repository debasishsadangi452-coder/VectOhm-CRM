import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { DealDocumentsService } from "./deal-documents.service";
import { DealDocumentStorageService } from "./deal-document-storage.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";
import { Department } from "../../common/decorators/department.decorator";

// A proposal is a document, not a media file -- 25MB is generous for a PDF
// and keeps a mis-drop (a video, a design export) from filling the volume.
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

@Department("Sales")
@Controller("deal-documents")
export class DealDocumentsController {
  constructor(
    private readonly service: DealDocumentsService,
    private readonly storage: DealDocumentStorageService,
  ) {}

  @Get()
  findAll(@Query("dealId") dealId: string) {
    if (!dealId) {
      throw new BadRequestException("dealId is required");
    }
    return this.service.findAll(dealId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: DealDocumentStorageService.multerStorage(),
      limits: { fileSize: MAX_DOCUMENT_BYTES },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body("dealId") dealId: string,
    @Body("note") note: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    // Multer has already written the file by the time this runs, so every
    // rejection path has to delete it or the upload is orphaned on the volume.
    try {
      if (!dealId) {
        throw new BadRequestException("dealId is required");
      }
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new BadRequestException("Attach a PDF or Word document");
      }
      return await this.service.create(dealId, file, note, user);
    } catch (err) {
      await this.storage.delete(file.filename);
      throw err;
    }
  }

  @Get(":id/download")
  async download(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    const document = await this.service.download(id);
    res.set({
      "Content-Type": document.mimeType,
      // Quotes + encoding so filenames with spaces or commas survive the header.
      "Content-Disposition": `attachment; filename="${encodeURIComponent(document.originalName)}"`,
    });
    return new StreamableFile(document.buffer);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
