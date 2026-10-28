import { Module } from "@nestjs/common";
import { TrackingController } from "./tracking.controller";
import { EngagementModule } from "../engagement/engagement.module";

@Module({
  imports: [EngagementModule],
  controllers: [TrackingController],
})
export class TrackingModule {}
