import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { rm } from "node:fs/promises";
import { ScreenRecordingsService } from "./screen-recordings.service";
import { ScreenRecordingStorageService } from "./screen-recording-storage.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

const MAX_RECORDING_BYTES = 200 * 1024 * 1024;

@Controller("screen-recordings")
export class ScreenRecordingsController {
  constructor(private readonly service: ScreenRecordingsService) {}

  // Uploaded by the desktop agent as the employee being recorded.
  // Streams file to temporary disk staging, validates, uploads to Bunny Storage,
  // and immediately unlinks the temporary file (never permanently stored locally).
  // `thumbnail` (agent 0.7.5+) is an optional JPEG of the screen when the clip started.
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "file", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
      ],
      {
        storage: ScreenRecordingStorageService.multerStorage(),
        limits: { fileSize: MAX_RECORDING_BYTES },
      },
    ),
  )
  async create(
    @UploadedFiles() files: { file?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] },
    @Body("durationSec") durationSec: string,
    @CurrentUser() user: RequestUser,
  ) {
    const file = files?.file?.[0];
    const thumbnail = files?.thumbnail?.[0];
    if (!file) {
      if (thumbnail) await rm(thumbnail.path, { force: true });
      throw new BadRequestException("No recording uploaded");
    }
    const seconds = Number(durationSec);
    return this.service.create(
      user,
      file,
      Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0,
      thumbnail,
    );
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("userId") userId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.list(user, { userId, from, to });
  }

  @Get(":id/video")
  async video(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const playback = await this.service.getPlayback(id, user, req.headers.range);

    if (playback.kind === "unsatisfiable") {
      res
        .status(416)
        .set({ "Content-Range": `bytes */${playback.size}` })
        .end();
      return;
    }

    res.status(playback.status);
    res.set(playback.headers);
    playback.stream.pipe(res);
  }

  @Get(":id/thumbnail")
  async thumbnail(@Param("id") id: string, @CurrentUser() user: RequestUser, @Res() res: Response) {
    const stream = await this.service.getThumbnail(id, user);
    // A clip's thumbnail never changes, so the browser can keep it.
    res.set({ "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" });
    stream.pipe(res);
  }

  @Get(":id/download")
  async download(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const download = await this.service.getForDownload(id, user);

    res.set({
      "Content-Type": download.mimeType,
      "Content-Disposition": `attachment; filename="${download.filename}"`,
      "Content-Length": String(download.sizeBytes),
      "Cache-Control": "private, no-cache",
    });

    download.stream.pipe(res);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
