import { Module } from "@nestjs/common";
import { EmailSuppressionController } from "./email-suppression.controller";
import { EmailSuppressionService } from "./email-suppression.service";

@Module({
  controllers: [EmailSuppressionController],
  providers: [EmailSuppressionService],
  exports: [EmailSuppressionService],
})
export class EmailSuppressionModule {}
