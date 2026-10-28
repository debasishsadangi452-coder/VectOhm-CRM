import { Module } from "@nestjs/common";
import { SequencesController } from "./sequences.controller";
import { SequencesService } from "./sequences.service";
import { SequenceEngineService } from "./sequence-engine.service";
import { EmailSuppressionModule } from "../email-suppression/email-suppression.module";
import { EmailConnectionsModule } from "../email-connections/email-connections.module";
import { EmailOAuthModule } from "../email-oauth/email-oauth.module";
import { EngagementModule } from "../engagement/engagement.module";

@Module({
  imports: [EmailSuppressionModule, EmailConnectionsModule, EmailOAuthModule, EngagementModule],
  controllers: [SequencesController],
  providers: [SequencesService, SequenceEngineService],
  exports: [SequencesService],
})
export class SequencesModule {}
