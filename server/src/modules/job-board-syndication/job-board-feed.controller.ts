import { Controller, Get, Header } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { JobBoardSyndicationService } from "./job-board-syndication.service";

@Controller("job-board-feeds")
export class JobBoardFeedController {
  constructor(private readonly syndication: JobBoardSyndicationService) {}

  // Public: this is the URL a recruiter registers once in Indeed's employer
  // dashboard, and Indeed's crawler re-pulls it on its own schedule -- no
  // Authorization header will ever be attached to this request.
  @Public()
  @Get("indeed.xml")
  @Header("Content-Type", "application/xml")
  indeedFeed(): Promise<string> {
    return this.syndication.buildIndeedFeedXml();
  }

  // Public for the same reason as indeedFeed -- this is the URL to submit to
  // LinkedIn's Job Wrapping / Limited Listings review once ready (see
  // JobBoardSyndicationService.buildLinkedInFeedXml).
  @Public()
  @Get("linkedin.xml")
  @Header("Content-Type", "application/xml")
  linkedInFeed(): Promise<string> {
    return this.syndication.buildLinkedInFeedXml();
  }
}
