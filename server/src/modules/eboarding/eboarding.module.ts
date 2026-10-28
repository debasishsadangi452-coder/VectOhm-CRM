import { Module } from "@nestjs/common";
import { EboardingController } from "./eboarding.controller";
import { EboardingService } from "./eboarding.service";

@Module({
  controllers: [EboardingController],
  providers: [EboardingService],
  exports: [EboardingService],
})
export class EboardingModule {}
