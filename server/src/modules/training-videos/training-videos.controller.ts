import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { TrainingVideosService } from "./training-videos.service";
import { CreateTrainingVideoDto } from "./dto/create-training-video.dto";
import { UpdateTrainingVideoDto } from "./dto/update-training-video.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

// Plain CRUD over links -- this app never holds the video bytes, so there is
// no upload, no streaming, and no signed playback URL. Permissions live in
// the service (Admin or any Manager to post; uploader or Admin to change).
@Controller("training-videos")
export class TrainingVideosController {
  constructor(private readonly service: TrainingVideosService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.service.findAll(user);
  }

  @Post()
  create(@Body() dto: CreateTrainingVideoDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateTrainingVideoDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user);
  }
}
