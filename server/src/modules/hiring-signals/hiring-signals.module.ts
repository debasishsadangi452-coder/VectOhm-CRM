import { Module } from "@nestjs/common";
import { HiringSignalAutomationController } from "./hiring-signal-automation.controller";
import { HiringSignalAutomationService } from "./hiring-signal-automation.service";
import { HiringSignalsDiscoveryService } from "./hiring-signals-discovery.service";
import { GreenhouseAdapter } from "./adapters/greenhouse.adapter";
import { AshbyAdapter } from "./adapters/ashby.adapter";
import { LeverAdapter } from "./adapters/lever.adapter";
import { AdzunaAdapter } from "./adapters/adzuna.adapter";
import { ApolloIntegrationModule } from "../apollo-integration/apollo-integration.module";
import { SequencesModule } from "../sequences/sequences.module";
import { CompanyGrowthModule } from "../company-growth/company-growth.module";
import { BulkEmailModule } from "../bulk-email/bulk-email.module";
import { EmailSuppressionModule } from "../email-suppression/email-suppression.module";
import { EmailConnectionsModule } from "../email-connections/email-connections.module";
import { EmailOAuthModule } from "../email-oauth/email-oauth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AiUsageModule } from "../ai-usage/ai-usage.module";
import { IntentAutomationController } from "./intent-automation.controller";
import { IntentAutomationService } from "./intent-automation.service";
import { IntentAutomationAiService } from "./intent-automation-ai.service";

@Module({
  imports: [
    ApolloIntegrationModule,
    SequencesModule,
    CompanyGrowthModule,
    BulkEmailModule,
    EmailSuppressionModule,
    EmailConnectionsModule,
    EmailOAuthModule,
    NotificationsModule,
    AiUsageModule,
  ],
  controllers: [HiringSignalAutomationController, IntentAutomationController],
  providers: [
    HiringSignalAutomationService,
    HiringSignalsDiscoveryService,
    IntentAutomationService,
    IntentAutomationAiService,
    GreenhouseAdapter,
    AshbyAdapter,
    LeverAdapter,
    AdzunaAdapter,
  ],
  exports: [HiringSignalAutomationService, HiringSignalsDiscoveryService, IntentAutomationService],
})
export class HiringSignalsModule {}
