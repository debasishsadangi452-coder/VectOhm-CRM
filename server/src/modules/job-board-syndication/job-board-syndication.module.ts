import { Module } from "@nestjs/common";
import { JobBoardSyndicationService } from "./job-board-syndication.service";
import { JobBoardSyndicationController } from "./job-board-syndication.controller";
import { JobBoardFeedController } from "./job-board-feed.controller";
import { JobBoardConnectionService } from "./job-board-connection.service";
import { JobBoardConnectionController } from "./job-board-connection.controller";
import { AggregatorConnectionService } from "./aggregator-connection.service";
import { AggregatorConnectionController } from "./aggregator-connection.controller";
import { AggregatorClient } from "./adapters/aggregator-client.service";
import { LinkedInAdapter } from "./adapters/linkedin.adapter";
import { NaukriAdapter } from "./adapters/naukri.adapter";
import { GlassdoorAdapter } from "./adapters/glassdoor.adapter";
import { IndeedAdapter } from "./adapters/indeed.adapter";
import { ZipRecruiterAdapter } from "./adapters/zip-recruiter.adapter";
import { MonsterAdapter } from "./adapters/monster.adapter";
import { DiceAdapter } from "./adapters/dice.adapter";
import { SimplyHiredAdapter } from "./adapters/simply-hired.adapter";
import { CareerBuilderAdapter } from "./adapters/career-builder.adapter";
import { GoogleJobsAdapter } from "./adapters/google-jobs.adapter";
import { LinkedInConnectionModule } from "../linkedin-connection/linkedin-connection.module";

@Module({
  imports: [LinkedInConnectionModule],
  controllers: [
    JobBoardSyndicationController,
    JobBoardFeedController,
    JobBoardConnectionController,
    AggregatorConnectionController,
  ],
  providers: [
    JobBoardSyndicationService,
    JobBoardConnectionService,
    AggregatorConnectionService,
    AggregatorClient,
    LinkedInAdapter,
    NaukriAdapter,
    GlassdoorAdapter,
    IndeedAdapter,
    ZipRecruiterAdapter,
    MonsterAdapter,
    DiceAdapter,
    SimplyHiredAdapter,
    CareerBuilderAdapter,
    GoogleJobsAdapter,
  ],
  exports: [JobBoardSyndicationService, JobBoardConnectionService, AggregatorConnectionService],
})
export class JobBoardSyndicationModule {}
