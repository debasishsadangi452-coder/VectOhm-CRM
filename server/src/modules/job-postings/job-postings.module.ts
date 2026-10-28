import { Module } from "@nestjs/common";
import { JobPostingsController } from "./job-postings.controller";
import { JobPostingsService } from "./job-postings.service";
import { JobBoardSyndicationModule } from "../job-board-syndication/job-board-syndication.module";

@Module({
  imports: [JobBoardSyndicationModule],
  controllers: [JobPostingsController],
  providers: [JobPostingsService],
  exports: [JobPostingsService],
})
export class JobPostingsModule {}
