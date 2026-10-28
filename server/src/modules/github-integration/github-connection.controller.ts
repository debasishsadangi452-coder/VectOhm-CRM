import { Body, Controller, Delete, Get, Post, Put } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { GithubService } from "./github.service";
import { ConnectGithubDto } from "./dto/connect-github.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("github/connection")
export class GithubConnectionController {
  constructor(private readonly githubService: GithubService) {}

  // Status only -- never returns the token. Open to any authed user so
  // project forms can tell whether a repo will be auto-created.
  @Get()
  getStatus() {
    return this.githubService.getStatus();
  }

  @Roles(RoleName.ADMIN)
  @Put()
  connect(@Body() dto: ConnectGithubDto, @CurrentUser() user: RequestUser) {
    return this.githubService.connect(dto.accountType, dto.accountLogin, dto.token, user.email);
  }

  @Roles(RoleName.ADMIN)
  @Post("test")
  test() {
    return this.githubService.testStored();
  }

  @Roles(RoleName.ADMIN)
  @Delete()
  async disconnect() {
    await this.githubService.disconnect();
    return { connected: false };
  }
}
