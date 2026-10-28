import { Module } from "@nestjs/common";
import { EmailAiController } from "./email-ai.controller";
import { EmailAiService } from "./email-ai.service";
import { AiUsageModule } from "../ai-usage/ai-usage.module";

@Module({
  imports: [AiUsageModule],
  controllers: [EmailAiController],
  providers: [EmailAiService],
  exports: [EmailAiService],
})
export class EmailAiModule {}
