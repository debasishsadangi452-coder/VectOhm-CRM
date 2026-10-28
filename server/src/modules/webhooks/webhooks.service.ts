import { Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handlePushEvent(payload: any) {
    const commits = payload.commits || [];
    const branch = payload.ref ? payload.ref.replace("refs/heads/", "") : "main";

    for (const commit of commits) {
      const hash = commit.id;
      const message = commit.message;
      const githubUsername = commit.author?.username;

      if (!githubUsername) {
        this.logger.warn(`Commit ${hash} has no GitHub username, skipping.`);
        continue;
      }

      // Find author by githubUsername
      const author = await this.prisma.user.findUnique({
        where: { githubUsername },
      });

      if (!author) {
        this.logger.warn(`No user found with githubUsername: ${githubUsername}`);
        continue;
      }

      // Extract Task ID (DEV-\d+ format) from message if present
      const taskRegex = /DEV-(\d+)/i;
      const match = message.match(taskRegex);
      const taskNumberStr = match ? match[1] : null;

      // Verify task exists if ID is found
      let validTaskId = null;
      if (taskNumberStr) {
        const taskNumber = parseInt(taskNumberStr, 10);
        const task = await this.prisma.task.findFirst({ where: { taskNumber } });
        if (task) validTaskId = task.id;
      }

      // Check if commit already exists
      const existing = await this.prisma.gitCommit.findUnique({ where: { hash } });
      if (existing) {
        continue;
      }

      await this.prisma.gitCommit.create({
        data: {
          hash,
          message,
          branch,
          authorId: author.id,
          taskId: validTaskId,
          isPR: false,
        },
      });

      this.logger.log(`Created GitCommit ${hash} for user ${author.email}`);
    }
  }

  async handlePullRequestEvent(payload: any) {
    const action = payload.action;
    const pr = payload.pull_request;
    if (!pr) return;

    const githubUsername = pr.user?.login;
    if (!githubUsername) return;

    const author = await this.prisma.user.findUnique({
      where: { githubUsername },
    });

    if (!author) {
      this.logger.warn(`No user found with githubUsername: ${githubUsername} for PR`);
      return;
    }

    // Extract Task ID from PR title or body
    const taskRegex = /DEV-(\d+)/i;
    let match = pr.title?.match(taskRegex);
    if (!match) {
      match = pr.body?.match(taskRegex);
    }
    const taskNumberStr = match ? match[1] : null;

    let validTaskId = null;
    if (taskNumberStr) {
      const taskNumber = parseInt(taskNumberStr, 10);
      const task = await this.prisma.task.findFirst({ where: { taskNumber } });
      if (task) validTaskId = task.id;
    }

    const prNumber = pr.number;
    const branch = pr.head?.ref || "main";
    const hash = pr.head?.sha || randomBytes(4).toString("hex"); // fallback

    let prStatus = "OPEN";
    if (action === "closed") {
      prStatus = pr.merged ? "MERGED" : "CLOSED";
    }

    // We can use the PR number and author to find an existing PR commit record
    let commitRecord = await this.prisma.gitCommit.findFirst({
      where: { prNumber, isPR: true },
    });

    if (commitRecord) {
      // Update existing
      await this.prisma.gitCommit.update({
        where: { id: commitRecord.id },
        data: {
          prStatus,
          message: pr.title,
          taskId: validTaskId ?? commitRecord.taskId,
        },
      });
      commitRecord.prStatus = prStatus;
      commitRecord.taskId = validTaskId ?? commitRecord.taskId;
    } else {
      // Create new
      commitRecord = await this.prisma.gitCommit.create({
        data: {
          hash,
          message: pr.title,
          branch,
          authorId: author.id,
          taskId: validTaskId,
          isPR: true,
          prStatus,
          prNumber,
        },
      });
    }

    this.logger.log(`PR #${prNumber} handled, status: ${prStatus}`);

    // Automatically transition linked task to DONE if merged
    if (prStatus === "MERGED" && commitRecord.taskId) {
      await this.prisma.task.update({
        where: { id: commitRecord.taskId },
        data: { status: "DONE" },
      });
      this.logger.log(`Linked task ${commitRecord.taskId} marked as DONE.`);
    }
  }

  async handleStatusEvent(payload: any) {
    const hash = payload.sha;
    const state = payload.state; // 'pending', 'success', 'failure', 'error'
    
    let buildStatus = "PENDING";
    if (state === "success") buildStatus = "SUCCESS";
    else if (state === "failure" || state === "error") buildStatus = "FAILURE";

    if (hash) {
      await this.prisma.gitCommit.updateMany({
        where: { hash },
        data: { buildStatus }
      });
      this.logger.log(`Updated build status for ${hash} to ${buildStatus}`);
    }
  }

  async handleCheckRunEvent(payload: any) {
    if (payload.action !== 'completed' && payload.action !== 'created') return;
    const hash = payload.check_run?.head_sha;
    const conclusion = payload.check_run?.conclusion;
    
    let buildStatus = "PENDING";
    if (conclusion === "success") buildStatus = "SUCCESS";
    else if (conclusion === "failure" || conclusion === "timed_out") buildStatus = "FAILURE";

    if (hash) {
      await this.prisma.gitCommit.updateMany({
        where: { hash },
        data: { buildStatus }
      });
      this.logger.log(`Updated build status for check_run ${hash} to ${buildStatus}`);
    }
  }
}
