import { Module } from "@nestjs/common";
import { GithubConnectionController } from "./github-connection.controller";
import { GithubService } from "./github.service";

@Module({
  controllers: [GithubConnectionController],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubIntegrationModule {}
