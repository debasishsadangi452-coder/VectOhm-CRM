import { Module } from "@nestjs/common";
import { LateStartRequestsController } from "./late-start-requests.controller";
import { LateStartRequestsService } from "./late-start-requests.service";

@Module({
  controllers: [LateStartRequestsController],
  providers: [LateStartRequestsService],
})
export class LateStartRequestsModule {}
