import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { extname } from "node:path";
import { CandidateStage } from "@prisma/client";
import { CandidatesService } from "./candidates.service";
import { CandidateStorageService } from "./candidate-storage.service";
import { CreateCandidateDto } from "./dto/create-candidate.dto";
import { UpdateCandidateDto } from "./dto/update-candidate.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

const MAX_RESUME_BYTES = 25 * 1024 * 1024; // 25MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/rtf",
]);

@Department("Recruitment")
@Controller("candidates")
export class CandidatesController {
  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly storage: CandidateStorageService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("jobPostingId") jobPostingId?: string,
    @Query("stage") stage?: CandidateStage,
    @Query("ownerId") ownerId?: string,
    @Query("mine") mine?: string,
    @Query("departmentId") departmentId?: string,
  ) {
    return this.candidatesService.findAll(
      {
        jobPostingId,
        stage,
        ownerId: mine === "true" ? user.id : ownerId,
        departmentId,
      },
      user,
    );
  }

  @Post("upload-resume")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: CandidateStorageService.multerStorage(),
      limits: { fileSize: MAX_RESUME_BYTES },
    }),
  )
  async uploadResume(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No resume file uploaded");
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      await this.storage.delete(file.filename);
      throw new BadRequestException("Attach a valid PDF or Word document (.pdf, .docx, .doc)");
    }

    return {
      url: `/candidates/resumes/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      sizeBytes: file.size,
      mimeType: file.mimetype,
    };
  }

  @Public()
  @Get("resumes/:filename")
  async getResume(@Param("filename") filename: string, @Res({ passthrough: true }) res: Response) {
    // Sanitize filename to prevent directory traversal
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    const buffer = await this.storage.read(safeName);

    const ext = extname(safeName).toLowerCase();
    const mimeType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : ext === ".doc"
        ? "application/msword"
        : ext === ".txt"
        ? "text/plain"
        : "application/octet-stream";

    res.set({
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(safeName)}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.candidatesService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateCandidateDto, @CurrentUser() user: RequestUser) {
    return this.candidatesService.create(dto, user);
  }

  @Post(":id/auto-screen")
  autoScreen(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.candidatesService.autoScreenCandidate(id, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCandidateDto, @CurrentUser() user: RequestUser) {
    return this.candidatesService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.candidatesService.remove(id, user);
  }
}
