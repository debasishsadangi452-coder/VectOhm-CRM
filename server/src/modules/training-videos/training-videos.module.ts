import { Module } from "@nestjs/common";
import { TrainingVideosController } from "./training-videos.controller";
import { TrainingVideosService } from "./training-videos.service";

@Module({
  controllers: [TrainingVideosController],
  providers: [TrainingVideosService],
})
export class TrainingVideosModule {}
