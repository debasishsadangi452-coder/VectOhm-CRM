import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { JobCollaborationService } from "./job-collaboration.service";
import { CreateJobTaskDto } from "./dto/create-job-task.dto";
import { CreateJobActivityDto } from "./dto/create-job-activity.dto";
import { CreateJobEmailMergeDto } from "./dto/create-job-email-merge.dto";
import { CreateJobSubmissionDto } from "./dto/create-job-submission.dto";
import { CreateJobNoteDto } from "./dto/create-job-note.dto";
import { CreateJobDocumentDto } from "./dto/create-job-document.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Department } from "../../common/decorators/department.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

// No class-level @Controller prefix: each sub-entity gets its own flat,
// explicit route (e.g. "/job-tasks") rather than nesting all six under one
// shared path -- see job-collaboration.service.ts for why they share one
// controller/service instead of six near-identical ones.
@Department("Recruitment")
@Controller()
export class JobCollaborationController {
  constructor(private readonly service: JobCollaborationService) {}

  // --- Tasks ---

  @Get("job-tasks")
  listTasks() {
    return this.service.listTasks();
  }

  @Post("job-tasks")
  createTask(@Body() dto: CreateJobTaskDto, @CurrentUser() user: RequestUser) {
    return this.service.createTask(dto, user);
  }

  @Delete("job-tasks/:id")
  deleteTask(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.deleteTask(id, user);
  }

  // --- Activities ---

  @Get("job-activities")
  listActivities() {
    return this.service.listActivities();
  }

  @Post("job-activities")
  createActivity(@Body() dto: CreateJobActivityDto, @CurrentUser() user: RequestUser) {
    return this.service.createActivity(dto, user);
  }

  // --- Email merges ---

  @Get("job-email-merges")
  listEmailMerges() {
    return this.service.listEmailMerges();
  }

  @Post("job-email-merges")
  createEmailMerge(@Body() dto: CreateJobEmailMergeDto, @CurrentUser() user: RequestUser) {
    return this.service.createEmailMerge(dto, user);
  }

  // --- Submissions ---

  @Get("job-submissions")
  listSubmissions() {
    return this.service.listSubmissions();
  }

  @Post("job-submissions")
  createSubmission(@Body() dto: CreateJobSubmissionDto, @CurrentUser() user: RequestUser) {
    return this.service.createSubmission(dto, user);
  }

  @Delete("job-submissions/:id")
  deleteSubmission(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.deleteSubmission(id, user);
  }

  // --- Notes ---

  @Get("job-notes")
  listNotes() {
    return this.service.listNotes();
  }

  @Post("job-notes")
  createNote(@Body() dto: CreateJobNoteDto, @CurrentUser() user: RequestUser) {
    return this.service.createNote(dto, user);
  }

  @Delete("job-notes/:id")
  deleteNote(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.deleteNote(id, user);
  }

  // --- Documents ---

  @Get("job-documents")
  listDocuments() {
    return this.service.listDocuments();
  }

  @Post("job-documents")
  createDocument(@Body() dto: CreateJobDocumentDto, @CurrentUser() user: RequestUser) {
    return this.service.createDocument(dto, user);
  }

  @Delete("job-documents/:id")
  deleteDocument(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.deleteDocument(id, user);
  }
}
