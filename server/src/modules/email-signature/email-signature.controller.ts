import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { EmailSignatureService } from "./email-signature.service";
import { SaveSignatureDto } from "./dto/save-signature.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

// A logo, not a photo library -- 2MB is plenty and keeps signature images from
// bloating every outbound email.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

@Controller("email-signature")
export class EmailSignatureController {
  constructor(private readonly service: EmailSignatureService) {}

  @Get()
  get(@CurrentUser() user: RequestUser) {
    return this.service.get(user);
  }

  @Put()
  save(@Body() dto: SaveSignatureDto, @CurrentUser() user: RequestUser) {
    return this.service.save(user, dto.html ?? null);
  }

  @Get("images")
  listImages(@CurrentUser() user: RequestUser) {
    return this.service.listImages(user);
  }

  @Post("images")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: EmailSignatureService.multerStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  async addImage(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: RequestUser) {
    if (!file) {
      throw new BadRequestException("No image uploaded");
    }
    // Multer has already written the file, so a rejection has to remove it.
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      await this.service.deleteFile(file.filename);
      throw new BadRequestException("Upload a PNG, JPEG, GIF, or WebP image");
    }
    return this.service.addImage(user, file);
  }

  // PUBLIC on purpose: this URL ends up in the <img> tag of a sent email, and
  // the recipient's mail client has no session here. Ids are uuids, so the
  // URL is unguessable -- but treat anything uploaded here as world-readable.
  @Public()
  @Get("image/:id")
  async getImage(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    const image = await this.service.readImage(id);
    res.set({
      "Content-Type": image.mimeType,
      // Mail clients and their proxies re-fetch aggressively; a logo never
      // changes for a given id, so let them cache it hard.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin",
    });
    return new StreamableFile(image.stream);
  }

  @Delete("images/:id")
  removeImage(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.removeImage(id, user);
  }
}
