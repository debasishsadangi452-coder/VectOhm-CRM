import {
  BadRequestException,
  Controller,
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
import { ScreenMonitoringService } from "./screen-monitoring.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

const MAX_CAPTURE_BYTES = 8 * 1024 * 1024; // 8MB -- generous for a JPEG screenshot

@Controller("screen-monitoring")
export class ScreenMonitoringController {
  constructor(private readonly service: ScreenMonitoringService) {}

  // Uploaded by the desktop agent, authenticated as the employee being
  // captured -- userId always comes from the token, never the request body.
  @Post("captures")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_CAPTURE_BYTES } }))
  async create(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: RequestUser) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return this.service.create(user, file.buffer);
  }

  @Get("captures")
  list(
    @CurrentUser() user: RequestUser,
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.list(user, { userId, from, to });
  }

  @Get("captures/:id/image")
  async getImage(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.service.getImage(id, user);
    res.set({ "Content-Type": "image/jpeg" });
    return new StreamableFile(buffer);
  }
}
