import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { RoleName } from "@prisma/client";
import type Anthropic from "@anthropic-ai/sdk";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../common/types/request-user.type";
import { hasDepartmentAccess } from "../../common/utils/department-access";
import { isHrUser } from "../../common/utils/directory-access";
import { canUseSalesOrRecruitment } from "../../common/utils/sales-access";
import type { IntentAutomationService } from "../hiring-signals/intent-automation.service";
import type { TasksService } from "../tasks/tasks.service";
import type { ProjectsService } from "../projects/projects.service";
import type { LeaveRequestsService } from "../leave-requests/leave-requests.service";
import type { AttendanceReportService } from "../work-sessions/attendance-report.service";
import type { DealsService } from "../deals/deals.service";
import { CreateIntentAutomationDto } from "../hiring-signals/dto/intent-automation.dto";
import { CreateTaskDto } from "../tasks/dto/create-task.dto";

export interface ToolContext {
  prisma: PrismaService;
  intent: IntentAutomationService;
  tasks: TasksService;
  projects: ProjectsService;
  leave: LeaveRequestsService;
  attendance: AttendanceReportService;
  deals: DealsService;
}

export interface AssistantTool {
  name: string;
  description: string;
  schema: Anthropic.Tool.InputSchema;
  // Writes never run on the model's say-so: they become a confirm card.
  write: boolean;
  // Role / department gate. The services behind each tool enforce their own
  // rules too -- this decides what the model is told it can do at all.
  allowed(user: RequestUser): boolean;
  // Human-readable description shown on the confirm card (writes only).
  summarize?(input: Record<string, unknown>, ctx: ToolContext, user: RequestUser): Promise<string>;
  run(input: Record<string, unknown>, ctx: ToolContext, user: RequestUser): Promise<unknown>;
}

// -------------------------------------------------------------------- helpers

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const clip = (v: string | null | undefined, n = 200) => (v && v.length > n ? `${v.slice(0, n)}…` : (v ?? null));
const day = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const person = (p: { firstName: string; lastName: string } | null | undefined) =>
  p ? `${p.firstName} ${p.lastName}`.trim() : null;
const requireId = (input: Record<string, unknown>, key: string) => {
  const v = str(input[key]);
  if (!v) throw new BadRequestException(`${key} is required`);
  return v;
};
const isAdmin = (u: RequestUser) => u.role.name === RoleName.ADMIN;
const any = () => true;

async function validated<T extends object>(cls: new () => T, input: unknown): Promise<T> {
  const instance = plainToInstance(cls, input);
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length > 0) {
    throw new BadRequestException(errors.flatMap((e) => Object.values(e.constraints ?? {})).join("; "));
  }
  return instance;
}

const obj = (properties: Record<string, unknown>, required: string[] = []): Anthropic.Tool.InputSchema => ({
  type: "object",
  properties: properties as Record<string, unknown>,
  required,
});

async function automationName(ctx: ToolContext, user: RequestUser, id: string): Promise<string> {
  const all = await ctx.intent.list(user);
  return all.find((a) => a.id === id)?.name ?? "(unknown automation)";
}

async function outreachRow(ctx: ToolContext, user: RequestUser, id: string) {
  const rows = await ctx.intent.listOutreach(user, { status: "PENDING_APPROVAL" as never });
  return rows.find((r) => r.id === id) ?? null;
}

// ---------------------------------------------------------------------- tools

export function buildTools(): AssistantTool[] {
  const intentAllowed = canUseSalesOrRecruitment;

  return [
    // ───────────────────────── Intent automations (read)
    {
      name: "list_intent_automations",
      description:
        "List the scheduled Intent Hiring / Intent News automations the user can see, with schedule, on/off state, auto-send mode, last run and how many emails wait for approval.",
      schema: obj({}),
      write: false,
      allowed: intentAllowed,
      async run(_input, ctx, user) {
        const list = await ctx.intent.list(user);
        return list.map((a) => ({
          id: a.id,
          name: a.name,
          source: a.source,
          active: a.isActive,
          schedule: `${a.frequency} at ${a.timeOfDay} IST`,
          nextRunAt: a.nextRunAt,
          autoSend: a.autoSend,
          dailyCap: a.dailyCap,
          pendingApproval: a.pendingApproval,
          lastRun: a.lastRun
            ? { status: a.lastRun.status, found: a.lastRun.leadsFound, sent: a.lastRun.sent, queued: a.lastRun.queued, error: a.lastRun.error }
            : null,
        }));
      },
    },
    {
      name: "get_automation_leads",
      description:
        "Show the leads an automation has found (companies, the job/news signal, the decision maker, and whether an email was sent, queued or skipped and why).",
      schema: obj(
        {
          automationId: { type: "string" },
          outcome: { type: "string", enum: ["SENT", "QUEUED", "SKIPPED", "FAILED"] },
        },
        ["automationId"],
      ),
      write: false,
      allowed: intentAllowed,
      async run(input, ctx, user) {
        const leads = await ctx.intent.listLeads(requireId(input, "automationId"), user, {
          outcome: str(input.outcome) as never,
        });
        return {
          total: leads.length,
          leads: leads.slice(0, 40).map((l) => ({
            company: l.companyName,
            signal: `${l.signalType}: ${clip(l.signalTitle, 120)}`,
            contact: l.contactName ? `${l.contactName} (${l.contactTitle ?? ""}) ${l.contactEmail ?? "no email"}` : null,
            outcome: l.outcome,
            reason: l.skipReason,
          })),
        };
      },
    },
    {
      name: "list_pending_outreach",
      description: "List AI-written emails waiting for the user's approval (nothing in this list has been sent).",
      schema: obj({ automationId: { type: "string" } }),
      write: false,
      allowed: intentAllowed,
      async run(input, ctx, user) {
        const rows = await ctx.intent.listOutreach(user, {
          status: "PENDING_APPROVAL" as never,
          automationId: str(input.automationId),
        });
        return rows.slice(0, 30).map((r) => ({
          id: r.id,
          automation: r.automation.name,
          to: `${r.contactName} <${r.contactEmail}> at ${r.companyName}`,
          subject: r.subject,
          preview: clip(r.body, 160),
        }));
      },
    },

    // ───────────────────────── Intent automations (write)
    {
      name: "create_intent_automation",
      description:
        "Create a scheduled automation. Needs: name, source (HIRING, NEWS or BOTH), roles (for HIRING/BOTH), newsKeywords (for NEWS/BOTH), frequency (DAILY, WEEKDAYS, WEEKLY), timeOfDay (HH:MM IST), and offerDescription (what the company offers, at least 20 characters). autoSend defaults to false (emails wait for approval). Ask the user for anything missing instead of guessing.",
      schema: obj(
        {
          name: { type: "string" },
          source: { type: "string", enum: ["HIRING", "NEWS", "BOTH"] },
          roles: { type: "array", items: { type: "string" } },
          location: { type: "string" },
          newsKeywords: { type: "string" },
          newsCategory: { type: "string", enum: ["FUNDING", "EXPANSION", "LEADERSHIP", "PRODUCT", "PARTNERSHIP"] },
          newsDaysBack: { type: "integer" },
          frequency: { type: "string", enum: ["DAILY", "WEEKDAYS", "WEEKLY"] },
          timeOfDay: { type: "string", description: "HH:MM, 24h, IST" },
          weekday: { type: "integer", description: "0=Sunday..6=Saturday, for WEEKLY" },
          autoSend: { type: "boolean" },
          dailyCap: { type: "integer" },
          cooldownDays: { type: "integer" },
          offerDescription: { type: "string" },
          tone: { type: "string" },
        },
        ["name", "source", "frequency", "timeOfDay", "offerDescription"],
      ),
      write: true,
      allowed: intentAllowed,
      async summarize(input) {
        const where = [input.roles && `roles: ${(input.roles as string[]).join(", ")}`, input.newsKeywords && `news: ${input.newsKeywords}`]
          .filter(Boolean)
          .join("; ");
        return `Create automation "${input.name}" - ${input.source} (${where}), ${String(input.frequency).toLowerCase()} at ${input.timeOfDay} IST, ${
          input.autoSend ? "AUTO-SENDS emails without review" : "emails wait for your approval"
        }, up to ${input.dailyCap ?? 25} per day.`;
      },
      async run(input, ctx, user) {
        const dto = await validated(CreateIntentAutomationDto, input);
        const created = await ctx.intent.create(dto, user);
        return { id: created.id, name: created.name, nextRunAt: created.nextRunAt };
      },
    },
    {
      name: "set_intent_automation_active",
      description: "Turn an automation on (resume) or off (pause).",
      schema: obj({ automationId: { type: "string" }, active: { type: "boolean" } }, ["automationId", "active"]),
      write: true,
      allowed: intentAllowed,
      async summarize(input, ctx, user) {
        return `${input.active ? "Resume" : "Pause"} automation "${await automationName(ctx, user, String(input.automationId))}".`;
      },
      async run(input, ctx, user) {
        const updated = await ctx.intent.update(requireId(input, "automationId"), { isActive: input.active === true }, user);
        return { id: updated.id, active: updated.isActive, nextRunAt: updated.nextRunAt };
      },
    },
    {
      name: "run_intent_automation",
      description: "Run an automation right now (searches, writes emails, and sends or queues them according to its settings).",
      schema: obj({ automationId: { type: "string" } }, ["automationId"]),
      write: true,
      allowed: intentAllowed,
      async summarize(input, ctx, user) {
        const all = await ctx.intent.list(user);
        const a = all.find((x) => x.id === input.automationId);
        return a
          ? `Run "${a.name}" now. ${a.autoSend ? "It is set to AUTO-SEND, so emails will go out immediately." : "Drafts will wait for your approval."}`
          : "Run an automation now.";
      },
      async run(input, ctx, user) {
        const run = await ctx.intent.runNow(requireId(input, "automationId"), user);
        return run && { status: run.status, found: run.leadsFound, sent: run.sent, queued: run.queued, skipped: run.skipped, failed: run.failed, error: run.error };
      },
    },
    {
      name: "approve_outreach",
      description: "Approve and SEND one queued email (use the id from list_pending_outreach).",
      schema: obj({ outreachId: { type: "string" } }, ["outreachId"]),
      write: true,
      allowed: intentAllowed,
      async summarize(input, ctx, user) {
        const row = await outreachRow(ctx, user, String(input.outreachId));
        return row
          ? `SEND this email to ${row.contactName} <${row.contactEmail}> at ${row.companyName}. Subject: "${row.subject}". "${clip(row.body, 220)}"`
          : "Send a queued email.";
      },
      async run(input, ctx, user) {
        const res = await ctx.intent.approve(requireId(input, "outreachId"), user);
        return { status: res.status, error: res.error };
      },
    },
    {
      name: "reject_outreach",
      description: "Reject (discard) one queued email without sending it.",
      schema: obj({ outreachId: { type: "string" } }, ["outreachId"]),
      write: true,
      allowed: intentAllowed,
      async summarize(input, ctx, user) {
        const row = await outreachRow(ctx, user, String(input.outreachId));
        return row ? `Discard the email "${row.subject}" to ${row.contactName} at ${row.companyName} (it will not be sent).` : "Discard a queued email.";
      },
      async run(input, ctx, user) {
        const res = await ctx.intent.reject(requireId(input, "outreachId"), user);
        return { status: res.status };
      },
    },
    {
      name: "approve_all_outreach",
      description: "Approve and SEND every email waiting in one automation's queue.",
      schema: obj({ automationId: { type: "string" } }, ["automationId"]),
      write: true,
      allowed: intentAllowed,
      async summarize(input, ctx, user) {
        const rows = await ctx.intent.listOutreach(user, { status: "PENDING_APPROVAL" as never, automationId: String(input.automationId) });
        return `SEND all ${rows.length} queued emails for "${await automationName(ctx, user, String(input.automationId))}".`;
      },
      async run(input, ctx, user) {
        return ctx.intent.approveAll(requireId(input, "automationId"), user);
      },
    },

    // ───────────────────────── CRM (read)
    {
      name: "search_contacts",
      description: "Search CRM contacts by name, email, title or company. Returns up to 20.",
      schema: obj({ query: { type: "string" } }, ["query"]),
      write: false,
      allowed: (u) => hasDepartmentAccess(u, ["Sales", "Recruitment"]),
      async run(input, ctx) {
        const q = requireId(input, "query");
        const rows = await ctx.prisma.contact.findMany({
          where: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
              { company: { name: { contains: q, mode: "insensitive" } } },
            ],
          },
          select: { id: true, firstName: true, lastName: true, email: true, title: true, company: { select: { name: true } } },
          take: 20,
        });
        return rows.map((c) => ({ id: c.id, name: person(c), email: c.email, title: c.title, company: c.company?.name ?? null }));
      },
    },
    {
      name: "search_companies",
      description: "Search CRM companies by name or domain. Returns up to 20.",
      schema: obj({ query: { type: "string" } }, ["query"]),
      write: false,
      allowed: (u) => hasDepartmentAccess(u, ["Sales"]),
      async run(input, ctx) {
        const q = requireId(input, "query");
        const rows = await ctx.prisma.company.findMany({
          where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { domain: { contains: q, mode: "insensitive" } }] },
          select: { id: true, name: true, domain: true, industry: true, employeeCount: true },
          take: 20,
        });
        return rows;
      },
    },
    {
      name: "list_deals",
      description: "List sales deals the user can see (optionally one stage) with a per-stage count.",
      schema: obj({ stage: { type: "string" } }),
      write: false,
      allowed: (u) => hasDepartmentAccess(u, ["Sales"]),
      async run(input, ctx, user) {
        const deals = await ctx.deals.findAll({ stage: str(input.stage) as never }, user);
        const byStage: Record<string, number> = {};
        for (const d of deals) byStage[d.stage] = (byStage[d.stage] ?? 0) + 1;
        return {
          total: deals.length,
          byStage,
          deals: deals.slice(0, 25).map((d) => ({ id: d.id, title: d.title, stage: d.stage, value: d.value, followUpAt: day(d.followUpAt) })),
        };
      },
    },

    // ───────────────────────── Tasks & projects
    {
      name: "list_tasks",
      description: "List tasks the user can see. Use mine=true for the user's own tasks.",
      schema: obj({
        mine: { type: "boolean" },
        status: { type: "string", enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "READY_FOR_TESTING", "CHANGES_REQUIRED", "DONE"] },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
      }),
      write: false,
      allowed: any,
      async run(input, ctx, user) {
        const tasks = await ctx.tasks.findAll(
          { status: str(input.status) as never, priority: str(input.priority) as never, assigneeId: input.mine ? user.id : undefined },
          user,
        );
        const now = Date.now();
        return {
          total: tasks.length,
          tasks: tasks.slice(0, 30).map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            due: day(t.dueDate),
            overdue: !!t.dueDate && t.status !== "DONE" && new Date(t.dueDate).getTime() < now,
            assignee: person(t.assignee),
          })),
        };
      },
    },
    {
      name: "list_projects",
      description: "List development projects the user can see.",
      schema: obj({ status: { type: "string", enum: ["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] } }),
      write: false,
      allowed: (u) => isAdmin(u) || hasDepartmentAccess(u, ["Dev"]),
      async run(input, ctx, user) {
        const projects = await ctx.projects.findAll({ status: str(input.status) as never }, user);
        return projects.slice(0, 30).map((p) => ({ id: p.id, name: p.name, status: p.status, due: day(p.dueDate), owner: person(p.owner), tasks: p._count.tasks }));
      },
    },
    {
      name: "find_user",
      description: "Look up a colleague by name to get their user id (needed to assign a task).",
      schema: obj({ query: { type: "string" } }, ["query"]),
      write: false,
      allowed: any,
      async run(input, ctx) {
        const q = requireId(input, "query");
        const rows = await ctx.prisma.user.findMany({
          where: {
            isActive: true,
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, firstName: true, lastName: true, department: { select: { name: true } }, role: { select: { name: true } } },
          take: 10,
        });
        return rows.map((u) => ({ id: u.id, name: person(u), department: u.department?.name ?? null, role: u.role.name }));
      },
    },
    {
      name: "create_task",
      description: "Create a task. title is required; assigneeId must come from find_user; dueDate is an ISO date.",
      schema: obj(
        {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          assigneeId: { type: "string" },
          dueDate: { type: "string", description: "ISO 8601" },
          projectId: { type: "string" },
        },
        ["title"],
      ),
      write: true,
      allowed: any,
      async summarize(input, ctx) {
        let who = "";
        if (input.assigneeId) {
          const u = await ctx.prisma.user.findUnique({ where: { id: String(input.assigneeId) }, select: { firstName: true, lastName: true } });
          who = ` assigned to ${person(u) ?? "an unknown user"}`;
        }
        return `Create task "${input.title}"${who}${input.dueDate ? `, due ${day(String(input.dueDate))}` : ""}${input.priority ? `, ${String(input.priority).toLowerCase()} priority` : ""}.`;
      },
      async run(input, ctx, user) {
        const dto = await validated(CreateTaskDto, input);
        const task = await ctx.tasks.create(dto, user);
        return { id: task.id, title: task.title, status: task.status };
      },
    },
    {
      name: "update_task_status",
      description: "Change a task's status. Completing a task has extra rules (tester/manager, time log, no open bugs) that the system enforces.",
      schema: obj(
        {
          taskId: { type: "string" },
          status: { type: "string", enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "READY_FOR_TESTING", "CHANGES_REQUIRED", "DONE"] },
        },
        ["taskId", "status"],
      ),
      write: true,
      allowed: any,
      async summarize(input, ctx) {
        const t = await ctx.prisma.task.findUnique({ where: { id: String(input.taskId) }, select: { title: true, status: true } });
        return t ? `Move task "${t.title}" from ${t.status} to ${input.status}.` : `Change a task's status to ${input.status}.`;
      },
      async run(input, ctx, user) {
        const updated = await ctx.tasks.update(requireId(input, "taskId"), { status: input.status as never }, user);
        return { id: updated.id, title: updated.title, status: updated.status };
      },
    },

    // ───────────────────────── HR & attendance
    {
      name: "list_leave_requests",
      description: "List leave requests the user may see (HR/Admin: everyone; managers: their department; others: their own).",
      schema: obj({ status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] } }),
      write: false,
      allowed: any,
      async run(input, ctx, user) {
        const rows = await ctx.leave.findAll(user, { status: str(input.status) as never });
        return rows.slice(0, 30).map((l) => ({
          id: l.id,
          employee: person(l.user),
          type: l.type,
          from: day(l.startDate),
          to: day(l.endDate),
          status: l.status,
          reason: clip(l.reason, 120),
        }));
      },
    },
    {
      name: "review_leave_request",
      description: "Approve or reject a pending leave request (HR and Admin only).",
      schema: obj(
        { leaveId: { type: "string" }, decision: { type: "string", enum: ["APPROVED", "REJECTED"] }, note: { type: "string" } },
        ["leaveId", "decision"],
      ),
      write: true,
      allowed: (u) => isAdmin(u) || isHrUser(u),
      async summarize(input, ctx) {
        const l = await ctx.prisma.leaveRequest.findUnique({
          where: { id: String(input.leaveId) },
          select: { startDate: true, endDate: true, user: { select: { firstName: true, lastName: true } } },
        });
        return l
          ? `${input.decision === "APPROVED" ? "Approve" : "Reject"} ${person(l.user)}'s leave (${day(l.startDate)} to ${day(l.endDate)}).${input.note ? ` Note: ${input.note}` : ""}`
          : `${input.decision} a leave request.`;
      },
      async run(input, ctx, user) {
        const updated = await ctx.leave.update(requireId(input, "leaveId"), { status: input.decision as never, reviewNote: str(input.note) } as never, user);
        return { id: updated.id, status: updated.status };
      },
    },
    {
      name: "attendance_today",
      description:
        "Today's live attendance: counts by status (working, on break, idle, not in, on leave...) and the people who are not working. Scope follows the user: HR/Admin see everyone, managers their department, others only themselves.",
      schema: obj({}),
      write: false,
      allowed: any,
      async run(_input, ctx, user) {
        const board = await ctx.attendance.getLiveBoard(user, {});
        return {
          counts: board.counts,
          notWorking: board.people
            .filter((p) => p.status !== "WORKING")
            .slice(0, 40)
            .map((p) => ({ name: p.name, status: p.status })),
        };
      },
    },
  ];
}

export function toolsFor(all: AssistantTool[], user: RequestUser): AssistantTool[] {
  return all.filter((t) => t.allowed(user));
}
