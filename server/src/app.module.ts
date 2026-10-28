import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { RolesModule } from "./modules/roles/roles.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { DepartmentsModule } from "./modules/departments/departments.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { DealsModule } from "./modules/deals/deals.module";
import { ActivitiesModule } from "./modules/activities/activities.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ChatModule } from "./modules/chat/chat.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { KnowledgeModule } from "./modules/knowledge/knowledge.module";
import { SprintsModule } from "./modules/sprints/sprints.module";
import { CommitsModule } from "./modules/commits/commits.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { DepartmentGuard } from "./common/guards/department.guard";
import { EpicsModule } from "./modules/epics/epics.module";
import { ReleasesModule } from "./modules/releases/releases.module";
import { SeoKeywordsModule } from "./modules/seo-keywords/seo-keywords.module";
import { SeoAuditsModule } from "./modules/seo-audits/seo-audits.module";
import { SeoBacklinksModule } from "./modules/seo-backlinks/seo-backlinks.module";
import { SeoContentBriefsModule } from "./modules/seo-content-briefs/seo-content-briefs.module";
import { SeoCompetitorsModule } from "./modules/seo-competitors/seo-competitors.module";
import { SeoMarketingCampaignsModule } from "./modules/seo-marketing-campaigns/seo-marketing-campaigns.module";
import { SeoKpiGoalsModule } from "./modules/seo-kpi-goals/seo-kpi-goals.module";
import { JobPostingsModule } from "./modules/job-postings/job-postings.module";
import { JobBoardSyndicationModule } from "./modules/job-board-syndication/job-board-syndication.module";
import { HiringSignalsModule } from "./modules/hiring-signals/hiring-signals.module";
import { AssistantModule } from "./modules/assistant/assistant.module";
import { CompanyGrowthModule } from "./modules/company-growth/company-growth.module";
import { CandidatesModule } from "./modules/candidates/candidates.module";
import { CareersModule } from "./modules/careers/careers.module";
import { InterviewsModule } from "./modules/interviews/interviews.module";
import { OffersModule } from "./modules/offers/offers.module";
import { RecruitmentAnalyticsModule } from "./modules/recruitment-analytics/recruitment-analytics.module";
import { AppSettingsModule } from "./modules/app-settings/app-settings.module";
import { GithubIntegrationModule } from "./modules/github-integration/github-integration.module";
import { LeaveRequestsModule } from "./modules/leave-requests/leave-requests.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { WorkSessionsModule } from "./modules/work-sessions/work-sessions.module";
import { TaskUpdatesModule } from "./modules/task-updates/task-updates.module";
import { ApolloIntegrationModule } from "./modules/apollo-integration/apollo-integration.module";
import { EmailTemplatesModule } from "./modules/email-templates/email-templates.module";
import { EmailSuppressionModule } from "./modules/email-suppression/email-suppression.module";
import { SequencesModule } from "./modules/sequences/sequences.module";
import { LoginEventsModule } from "./modules/login-events/login-events.module";
import { AttendanceAdjustmentsModule } from "./modules/attendance-adjustments/attendance-adjustments.module";
import { LateStartRequestsModule } from "./modules/late-start-requests/late-start-requests.module";
import { SignOutRequestsModule } from "./modules/signout-requests/signout-requests.module";
import { ScreenMonitoringModule } from "./modules/screen-monitoring/screen-monitoring.module";
import { LoginPhotosModule } from "./modules/login-photos/login-photos.module";
import { BulkEmailModule } from "./modules/bulk-email/bulk-email.module";
import { EmailAiModule } from "./modules/email-ai/email-ai.module";
import { ActivityMonitoringModule } from "./modules/activity-monitoring/activity-monitoring.module";
import { GoogleAdsAnalyticsModule } from "./modules/google-ads-analytics/google-ads-analytics.module";
import { EmailConnectionsModule } from "./modules/email-connections/email-connections.module";
import { EmailOAuthModule } from "./modules/email-oauth/email-oauth.module";
import { SyncedEmailsModule } from "./modules/synced-emails/synced-emails.module";
import { TrackingModule } from "./modules/tracking/tracking.module";
import { TaskListsModule } from "./modules/task-lists/task-lists.module";
import { TimeLogsModule } from "./modules/time-logs/time-logs.module";
import { TrainingVideosModule } from "./modules/training-videos/training-videos.module";
import { DealDocumentsModule } from "./modules/deal-documents/deal-documents.module";
import { EmailSignatureModule } from "./modules/email-signature/email-signature.module";
import { ScreenRecordingsModule } from "./modules/screen-recordings/screen-recordings.module";
import { TelephonyModule } from "./modules/telephony/telephony.module";
import { BugsModule } from "./modules/bugs/bugs.module";
import { EngagementModule } from "./modules/engagement/engagement.module";
import { FollowUpsModule } from "./modules/follow-ups/follow-ups.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { VendorsModule } from "./modules/vendors/vendors.module";
import { LeadsModule } from "./modules/leads/leads.module";
import { EboardingModule } from "./modules/eboarding/eboarding.module";
import { JobCollaborationModule } from "./modules/job-collaboration/job-collaboration.module";
import { LinkedInConnectionModule } from "./modules/linkedin-connection/linkedin-connection.module";
import { IntentNewsScraperModule } from "./modules/intent-news-scraper/intent-news-scraper.module";
import { AiUsageModule } from "./modules/ai-usage/ai-usage.module";
import { ErpTendersModule } from "./modules/erp-tenders/erp-tenders.module";
import { ErpBuyerSignalsModule } from "./modules/erp-buyer-signals/erp-buyer-signals.module";
import { IntentCrawlerModule } from "./modules/intent-crawler/intent-crawler.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "server/.env", "../server/.env"],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    ProjectsModule,
    TasksModule,
    TaskListsModule,
    TimeLogsModule,
    DepartmentsModule,
    CompaniesModule,
    ContactsModule,
    DealsModule,
    ActivitiesModule,
    DashboardModule,
    ChatModule,
    AnalyticsModule,
    KnowledgeModule,
    SprintsModule,
    CommitsModule,
    WebhooksModule,
    EpicsModule,
    ReleasesModule,
    SeoKeywordsModule,
    SeoAuditsModule,
    SeoBacklinksModule,
    SeoContentBriefsModule,
    SeoCompetitorsModule,
    SeoMarketingCampaignsModule,
    SeoKpiGoalsModule,
    JobPostingsModule,
    JobBoardSyndicationModule,
    HiringSignalsModule,
    AssistantModule,
    CompanyGrowthModule,
    CandidatesModule,
    CareersModule,
    InterviewsModule,
    OffersModule,
    RecruitmentAnalyticsModule,
    AppSettingsModule,
    GithubIntegrationModule,
    LeaveRequestsModule,
    NotificationsModule,
    WorkSessionsModule,
    TaskUpdatesModule,
    ApolloIntegrationModule,
    EmailTemplatesModule,
    EmailAiModule,
    EmailSuppressionModule,
    SequencesModule,
    LoginEventsModule,
    SignOutRequestsModule,
    AttendanceAdjustmentsModule,
    LateStartRequestsModule,
    ScreenMonitoringModule,
    LoginPhotosModule,
    BulkEmailModule,
    ActivityMonitoringModule,
    EmailConnectionsModule,
    EmailOAuthModule,
    SyncedEmailsModule,
    TrackingModule,
    TrainingVideosModule,
    DealDocumentsModule,
    EmailSignatureModule,
    ScreenRecordingsModule,
    TelephonyModule,
    BugsModule,
    EngagementModule,
    FollowUpsModule,
    ClientsModule,
    VendorsModule,
    LeadsModule,
    EboardingModule,
    JobCollaborationModule,
    LinkedInConnectionModule,
    GoogleAdsAnalyticsModule,
    IntentNewsScraperModule,
    AiUsageModule,
    ErpTendersModule,
    ErpBuyerSignalsModule,
    IntentCrawlerModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: DepartmentGuard },
  ],
})
export class AppModule {}
