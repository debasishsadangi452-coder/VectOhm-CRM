import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateJobTaskDto } from "./dto/create-job-task.dto";
import { CreateJobActivityDto } from "./dto/create-job-activity.dto";
import { CreateJobEmailMergeDto } from "./dto/create-job-email-merge.dto";
import { CreateJobSubmissionDto } from "./dto/create-job-submission.dto";
import { CreateJobNoteDto } from "./dto/create-job-note.dto";
import { CreateJobDocumentDto } from "./dto/create-job-document.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const createdByInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

// Shared across all six job-detail-panel sub-entities (tasks, activity log,
// email merges, submissions, notes, documents) -- they're small, structurally
// similar CRUD resources with no entity-specific business rules, so one
// service/controller covers all of them rather than repeating six near-
// identical module/controller/service triples.
@Injectable()
export class JobCollaborationService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Tasks ---

  listTasks() {
    return this.prisma.jobTask.findMany({ include: createdByInclude, orderBy: { createdAt: "desc" } });
  }

  createTask(dto: CreateJobTaskDto, creator: RequestUser) {
    return this.prisma.jobTask.create({
      data: {
        jobPostingId: dto.jobPostingId,
        taskName: dto.taskName,
        dueDate: dto.dueDate,
        timeZone: dto.timeZone,
        assignedTo: dto.assignedTo,
        assignedBy: dto.assignedBy,
        status: dto.status,
        completed: dto.completed,
        createdById: creator.id,
      },
      include: createdByInclude,
    });
  }

  async deleteTask(id: string, user: RequestUser) {
    const task = await this.prisma.jobTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException("Task not found");
    this.assertCanMutate(task, user);
    await this.prisma.jobTask.delete({ where: { id } });
  }

  // --- Activities (append-only) ---

  listActivities() {
    return this.prisma.jobActivity.findMany({ include: createdByInclude, orderBy: { createdAt: "desc" } });
  }

  createActivity(dto: CreateJobActivityDto, creator: RequestUser) {
    return this.prisma.jobActivity.create({
      data: {
        jobPostingId: dto.jobPostingId,
        description: dto.description,
        user: dto.user || `${creator.firstName} ${creator.lastName}`,
        type: dto.type,
        createdById: creator.id,
      },
      include: createdByInclude,
    });
  }

  // --- Email merges (append-only) ---

  listEmailMerges() {
    return this.prisma.jobEmailMerge.findMany({ include: createdByInclude, orderBy: { createdAt: "desc" } });
  }

  createEmailMerge(dto: CreateJobEmailMergeDto, creator: RequestUser) {
    return this.prisma.jobEmailMerge.create({
      data: {
        jobPostingId: dto.jobPostingId,
        subject: dto.subject,
        details: dto.details,
        sentBy: dto.sentBy || `${creator.firstName} ${creator.lastName}`,
        sentTo: dto.sentTo || "",
        searchString: dto.searchString,
        zipLocation: dto.zipLocation,
        createdById: creator.id,
      },
      include: createdByInclude,
    });
  }

  // --- Submissions ---

  listSubmissions() {
    return this.prisma.jobSubmission.findMany({ include: createdByInclude, orderBy: { createdAt: "desc" } });
  }

  createSubmission(dto: CreateJobSubmissionDto, creator: RequestUser) {
    return this.prisma.jobSubmission.create({
      data: {
        jobPostingId: dto.jobPostingId,
        candidateId: dto.candidateId,
        name: dto.name,
        status: dto.status,
        submittedBy: dto.submittedBy || `${creator.firstName} ${creator.lastName}`,
        contact: dto.contact,
        location: dto.location,
        statusLabel: dto.statusLabel,
        payRate: dto.payRate,
        billRate: dto.billRate,
        createdById: creator.id,
      },
      include: createdByInclude,
    });
  }

  async deleteSubmission(id: string, user: RequestUser) {
    const submission = await this.prisma.jobSubmission.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException("Submission not found");
    this.assertCanMutate(submission, user);
    await this.prisma.jobSubmission.delete({ where: { id } });
  }

  // --- Notes ---

  listNotes() {
    return this.prisma.jobNote.findMany({ include: createdByInclude, orderBy: { createdAt: "desc" } });
  }

  createNote(dto: CreateJobNoteDto, creator: RequestUser) {
    return this.prisma.jobNote.create({
      data: {
        jobPostingId: dto.jobPostingId,
        text: dto.text,
        action: dto.action,
        addedBy: dto.addedBy || `${creator.firstName} ${creator.lastName}`,
        createdById: creator.id,
      },
      include: createdByInclude,
    });
  }

  async deleteNote(id: string, user: RequestUser) {
    const note = await this.prisma.jobNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException("Note not found");
    this.assertCanMutate(note, user);
    await this.prisma.jobNote.delete({ where: { id } });
  }

  // --- Documents (metadata only -- no file bytes, see schema comment) ---

  listDocuments() {
    return this.prisma.jobDocument.findMany({ include: createdByInclude, orderBy: { createdAt: "desc" } });
  }

  createDocument(dto: CreateJobDocumentDto, creator: RequestUser) {
    return this.prisma.jobDocument.create({
      data: {
        jobPostingId: dto.jobPostingId,
        name: dto.name,
        type: dto.type,
        size: dto.size,
        addedBy: dto.addedBy || `${creator.firstName} ${creator.lastName}`,
        createdById: creator.id,
      },
      include: createdByInclude,
    });
  }

  async deleteDocument(id: string, user: RequestUser) {
    const doc = await this.prisma.jobDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Document not found");
    this.assertCanMutate(doc, user);
    await this.prisma.jobDocument.delete({ where: { id } });
  }

  private assertCanMutate(record: { createdById: string }, user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) return;
    if (record.createdById !== user.id) {
      throw new ForbiddenException("You do not have permission to modify this record");
    }
  }
}
