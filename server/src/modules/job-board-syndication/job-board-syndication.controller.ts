import { BadRequestException, Controller, Param, Post } from "@nestjs/common";
import { JobBoard } from "@prisma/client";
import { JobBoardSyndicationService } from "./job-board-syndication.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("job-postings")
export class JobBoardSyndicationController {
  constructor(private readonly syndication: JobBoardSyndicationService) {}

  @Post(":id/board-listings/:board/retry")
  retry(@Param("id") id: string, @Param("board") board: string, @CurrentUser() user: RequestUser) {
    const normalized = board.toUpperCase();
    if (!(Object.values(JobBoard) as string[]).includes(normalized)) {
      throw new BadRequestException(`Unknown job board "${board}"`);
    }
    return this.syndication.retry(id, normalized as JobBoard, user);
  }
}
