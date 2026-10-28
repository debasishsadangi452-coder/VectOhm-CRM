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
import { LoginPhotosService } from "./login-photos.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB -- generous for a single webcam frame

@Controller("login-photos")
export class LoginPhotosController {
  constructor(private readonly service: LoginPhotosService) {}

  // Fired by the frontend as a mandatory step before clocking in or out
  // (see work-session-toggle.tsx's requireCameraOrBlock) -- authenticated
  // as the user taking the action.
  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_PHOTO_BYTES } }))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body("type") type: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return this.service.create(user, file.buffer, type);
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("userId") userId?: string,
    @Query("type") type?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.list(user, { userId, type, from, to });
  }

  @Get(":id/image")
  async getImage(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.service.getImage(id, user);
    res.set({ "Content-Type": "image/jpeg" });
    return new StreamableFile(buffer);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
