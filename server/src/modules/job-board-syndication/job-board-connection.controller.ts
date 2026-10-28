import { BadRequestException, Body, Controller, Delete, Get, Param, Put } from "@nestjs/common";
import { JobBoard, RoleName } from "@prisma/client";
import { JobBoardConnectionService } from "./job-board-connection.service";
import { ConnectJobBoardDto } from "./dto/connect-job-board.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

import { Department } from "../../common/decorators/department.decorator";

@Department("Recruitment")
@Controller("job-board-connections")
export class JobBoardConnectionController {
  constructor(private readonly connections: JobBoardConnectionService) {}

  // Status only -- never returns the key. Open to any authed user so any
  // Recruitment employee can see whether a board is set up, same reasoning
  // as ApolloConnectionController.
  @Get()
  getAllStatuses() {
    return this.connections.getAllStatuses();
  }

  // @Roles filters out plain employees; the service's assertCanManage() adds
  // the finer-grained check that a MANAGER must actually belong to
  // Recruitment, which @Roles alone can't express.
  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Put(":board")
  connect(@Param("board") board: string, @Body() dto: ConnectJobBoardDto, @CurrentUser() user: RequestUser) {
    return this.connections.connect(this.parseBoard(board), dto.apiKey, user);
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Delete(":board")
  async disconnect(@Param("board") board: string, @CurrentUser() user: RequestUser) {
    await this.connections.disconnect(this.parseBoard(board), user);
    return { connected: false };
  }

  private parseBoard(board: string): JobBoard {
    const normalized = board.toUpperCase();
    if (!(Object.values(JobBoard) as string[]).includes(normalized)) {
      throw new BadRequestException(`Unknown job board "${board}"`);
    }
    return normalized as JobBoard;
  }
}
