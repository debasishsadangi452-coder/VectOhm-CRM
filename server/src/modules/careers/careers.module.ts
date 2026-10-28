import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { CareersController } from "./careers.controller";
import { CareersService } from "./careers.service";
import { CandidatesModule } from "../candidates/candidates.module";

@Module({
  imports: [
    // Registered here only, not globally -- these are the only public,
    // internet-reachable mutating routes in the app, so rate limiting stays
    // scoped to this module and touches nothing else's guard stack.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    CandidatesModule,
  ],
  controllers: [CareersController],
  providers: [CareersService],
})
export class CareersModule {}
