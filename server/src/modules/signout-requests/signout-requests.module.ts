import { Module } from "@nestjs/common";
import { SignOutRequestsController } from "./signout-requests.controller";
import { SignOutRequestsService } from "./signout-requests.service";

@Module({
  controllers: [SignOutRequestsController],
  providers: [SignOutRequestsService],
})
export class SignOutRequestsModule {}
