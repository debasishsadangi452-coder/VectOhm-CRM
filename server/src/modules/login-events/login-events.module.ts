import { Module } from "@nestjs/common";
import { LoginEventsController } from "./login-events.controller";
import { LoginEventsService } from "./login-events.service";

@Module({
  controllers: [LoginEventsController],
  providers: [LoginEventsService],
})
export class LoginEventsModule {}
