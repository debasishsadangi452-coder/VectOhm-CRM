import { Module } from "@nestjs/common";
import { EmailConnectionsController } from "./email-connections.controller";
import { EmailConnectionsService } from "./email-connections.service";
import { EmailOAuthModule } from "../email-oauth/email-oauth.module";

@Module({
  imports: [EmailOAuthModule],
  controllers: [EmailConnectionsController],
  providers: [EmailConnectionsService],
  exports: [EmailConnectionsService],
})
export class EmailConnectionsModule {}
