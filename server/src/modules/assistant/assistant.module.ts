import { Module } from "@nestjs/common";
import { AssistantController } from "./assistant.controller";
import { AssistantService } from "./assistant.service";
import { HiringSignalsModule } from "../hiring-signals/hiring-signals.module";
import { TasksModule } from "../tasks/tasks.module";
import { ProjectsModule } from "../projects/projects.module";
import { LeaveRequestsModule } from "../leave-requests/leave-requests.module";
import { WorkSessionsModule } from "../work-sessions/work-sessions.module";
import { DealsModule } from "../deals/deals.module";
import { AiUsageModule } from "../ai-usage/ai-usage.module";

@Module({
  imports: [HiringSignalsModule, TasksModule, ProjectsModule, LeaveRequestsModule, WorkSessionsModule, DealsModule, AiUsageModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
