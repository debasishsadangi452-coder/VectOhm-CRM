import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ThrottlerGuard } from "@nestjs/throttler";
import { CareersService } from "./careers.service";
import { CandidateStorageService } from "../candidates/candidate-storage.service";
import { SubmitApplicationDto } from "./dto/submit-application.dto";
import { Public } from "../../common/decorators/public.decorator";

// Same limits as CandidatesController.uploadResume -- kept in sync since both
// write into the same storage/resumes directory and get read back through
// the same GET /candidates/resumes/:filename endpoint.
const MAX_RESUME_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/rtf",
]);

// Fully public -- no @Department/@Roles gate anywhere in this controller.
// Reachable from the open internet by job seekers, so every mutating route
// is also behind ThrottlerGuard (see careers.module.ts for the limit).
@Controller("careers")
export class CareersController {
  constructor(
    private readonly careersService: CareersService,
    private readonly storage: CandidateStorageService,
  ) {}

  @Public()
  @Get("jobs")
  listOpenJobs() {
    return this.careersService.listOpenJobs();
  }

  @Public()
  @Get("jobs/:id")
  getOpenJob(@Param("id") id: string) {
    return this.careersService.getOpenJob(id);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post("apply/upload-resume")
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

    // Same path shape as CandidatesController.uploadResume -- it's the same
    // storage directory, so the existing public GET /candidates/resumes/:filename
    // route can already serve this back without a new endpoint.
    return { url: `/candidates/resumes/${file.filename}` };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post("apply")
  submitApplication(@Body() dto: SubmitApplicationDto) {
    return this.careersService.submitApplication(dto);
  }
}
