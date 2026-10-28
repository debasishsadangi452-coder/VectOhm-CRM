import { Injectable, Logger } from "@nestjs/common";
import { JobBoard } from "@prisma/client";
import type { JobBoardAdapter, JobBoardPostInput, JobBoardPostResult } from "../job-board.types";
import { simulatedPost } from "./simulated-post.util";
import { UnipileService } from "../../linkedin-connection/unipile.service";
import { careersApplyUrl } from "./careers-url.util";

@Injectable()
export class LinkedInAdapter implements JobBoardAdapter {
  readonly board = JobBoard.LINKEDIN;
  private readonly logger = new Logger(LinkedInAdapter.name);

  constructor(private readonly unipile: UnipileService) {}

  get simulated(): boolean {
    return !this.unipile.isConfigured();
  }

  async post(job: JobBoardPostInput): Promise<JobBoardPostResult> {
    if (!this.unipile.isConfigured()) {
      this.logger.log(
        `Unipile is not configured -- using fallback simulated post for LinkedIn job ${job.id}`,
      );
      return simulatedPost(this.logger, "LinkedIn", "linkedin", job);
    }

    try {
      const applyUrl = careersApplyUrl(job.id, "linkedin");
      const postText = this.buildLinkedInPostText(job, applyUrl);
      const jobHtml = this.buildLinkedInJobHtml(job, applyUrl);

      this.logger.log(
        `Creating LinkedIn Job Posting "${job.title}" (${job.id}) via Unipile...`,
      );

      const isRemote =
        (job.location && job.location.toLowerCase().includes("remote")) ||
        (job.title && job.title.toLowerCase().includes("remote"));

      // 1. Attempt official LinkedIn Job Posting API
      const jobResult = await this.unipile.createLinkedInJobPosting({
        title: job.title,
        companyName: job.client || "Venus Consultancy",
        workplace: isRemote ? "REMOTE" : "ON_SITE",
        location: job.location || "United States",
        descriptionHtml: jobHtml,
      });

      if (jobResult.success && jobResult.jobId) {
        const listingUrl = jobResult.jobUrl || `https://www.linkedin.com/jobs/view/${jobResult.jobId}/`;

        if (jobResult.verificationRequired) {
          this.logger.warn(
            `LinkedIn Job #${jobResult.jobId} created in Drafts! Identity verification required: ${jobResult.verificationUrl}`,
          );
        } else {
          this.logger.log(
            `LinkedIn Job #${jobResult.jobId} created and published: ${listingUrl}`,
          );
        }

        // Try companion feed post announcement as bonus
        this.unipile
          .createLinkedInPost({ text: postText, externalLink: applyUrl })
          .catch((err) => this.logger.debug(`Companion feed post skipped: ${err.message}`));

        return {
          externalId: jobResult.jobId,
          externalUrl: listingUrl,
        };
      }

      // 2. Fallback to LinkedIn feed post
      this.logger.log(`Job posting API returned ${jobResult.error} -- attempting Feed Post fallback...`);
      const postResult = await this.unipile.createLinkedInPost({
        text: postText,
        externalLink: applyUrl,
      });

      if (postResult.success && postResult.postId) {
        const listingUrl =
          postResult.postUrl ||
          `https://www.linkedin.com/feed/update/urn:li:activity:${postResult.postId}/`;
        return {
          externalId: postResult.postId,
          externalUrl: listingUrl,
        };
      }

      throw new Error(
        jobResult.error || postResult.error || "LinkedIn posting failed via Unipile",
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to publish job "${job.title}" (${job.id}) to LinkedIn: ${err.message}`,
      );
      throw err;
    }
  }

  private buildLinkedInJobHtml(job: JobBoardPostInput, applyUrl: string): string {
    const jobCode = job.jobCode || `JPC-${job.id.slice(0, 6).toUpperCase()}`;
    const skills = job.skillsRequired || [];
    const skillsHtml =
      skills.length > 0
        ? `<p><strong>Key Skills & Technologies:</strong></p><ul>${skills.map((s) => `<li>${s.trim()}</li>`).join("")}</ul>`
        : "";

    const periodSuffix = job.salaryPeriod === "HOURLY" ? "/hr" : job.salaryPeriod === "MONTHLY" ? "/mo" : "/yr";
    let comp = "";
    if (job.budgetMin != null && job.budgetMax != null) {
      comp = job.budgetMin === job.budgetMax ? `$${job.budgetMin}${periodSuffix}` : `$${job.budgetMin} - $${job.budgetMax} ${job.currency} ${periodSuffix}`;
    } else if (job.budgetMin != null) {
      comp = `$${job.budgetMin}${periodSuffix}`;
    }

    const locationText = [job.location, job.states].filter(Boolean).join(", ") || "Remote / Flexible";
    const typeLabel = job.employmentType ? job.employmentType.replace(/_/g, " ") : "Full Time";

    return `
      <h2>${job.title} [${jobCode}]</h2>
      <p><strong>Company:</strong> ${job.client || "Venus Consultancy"}</p>
      <p><strong>Location:</strong> ${locationText}</p>
      <p><strong>Employment Type:</strong> ${typeLabel}</p>
      ${comp ? `<p><strong>Compensation / Rate:</strong> ${comp}</p>` : ""}
      ${job.clientBillRate && job.clientBillRate !== "N/A" ? `<p><strong>Client Bill Rate:</strong> ${job.clientBillRate}</p>` : ""}
      ${job.minExperienceYears ? `<p><strong>Experience:</strong> ${job.minExperienceYears}+ Years</p>` : ""}
      ${skillsHtml}
      <h3>Job Description & Responsibilities</h3>
      <p>${job.description || "Venus Consultancy is actively seeking a qualified candidate to join our team."}</p>
      <hr />
      <h3>Direct Application</h3>
      <p>Submit your application and resume directly via our careers portal:</p>
      <p><a href="${applyUrl}">${applyUrl}</a></p>
    `.trim();
  }

  private buildLinkedInPostText(job: JobBoardPostInput, applyUrl: string): string {
    const jobCode = job.jobCode || `JPC-${job.id.slice(0, 6).toUpperCase()}`;
    const skills = job.skillsRequired || [];
    const skillsText =
      skills.length > 0
        ? `\n🛠️ Key Skills & Technologies:\n${skills.map((s) => `• ${s.trim()}`).join("\n")}`
        : "";

    // Pay rate / salary
    const periodSuffix = job.salaryPeriod === "HOURLY" ? "/hr" : job.salaryPeriod === "MONTHLY" ? "/mo" : "/yr";
    let compensationText = "";
    if (job.budgetMin != null && job.budgetMax != null) {
      compensationText =
        job.budgetMin === job.budgetMax
          ? `💰 Pay Rate / Salary: $${job.budgetMin}${periodSuffix}`
          : `💰 Pay Rate / Salary: $${job.budgetMin} - $${job.budgetMax} ${job.currency} ${periodSuffix}`;
    } else if (job.budgetMin != null) {
      compensationText = `💰 Pay Rate / Salary: $${job.budgetMin}${periodSuffix}`;
    }

    const billRateText =
      job.clientBillRate && job.clientBillRate !== "N/A"
        ? `💵 Client Bill Rate: ${job.clientBillRate}`
        : "";

    const clientText = job.client
      ? `🏢 Client / Org: ${job.client}`
      : "";

    const businessUnitText = job.businessUnit
      ? `🏛️ Business Unit: ${job.businessUnit}`
      : "";

    const fullLocation = [job.location, job.states].filter(Boolean).join(", ");
    const locationText = fullLocation
      ? `📍 Location: ${fullLocation}`
      : "📍 Location: Remote / Flexible";

    const typeLabel = job.employmentType
      ? job.employmentType.replace(/_/g, " ")
      : "Full Time";

    const expText =
      job.minExperienceYears && job.minExperienceYears > 0
        ? `⏳ Experience Required: ${job.minExperienceYears}+ Years`
        : "";

    const cleanTitleTag = `#${job.title.replace(/[^a-zA-Z0-9]/g, "")}`;
    const hashtags = ["#Hiring", "#JobOpening", "#Careers", "#WeAreHiring", cleanTitleTag]
      .filter(Boolean)
      .slice(0, 5)
      .join(" ");

    const descriptionSnippet = job.description
      ? `\n📋 Role Overview & Description:\n${job.description.length > 450 ? job.description.slice(0, 447) + "..." : job.description}`
      : "";

    return [
      `🚀 WE ARE HIRING: ${job.title.toUpperCase()} [${jobCode}] 🚀`,
      ``,
      `Venus Consultancy is actively seeking a qualified ${job.title} to join our high-performing team.`,
      ``,
      `📌 JOB REQUISITION DETAILS:`,
      `• Job Code: ${jobCode}`,
      `• Job Role: ${job.title}`,
      clientText,
      businessUnitText,
      locationText,
      `• Employment Type: ${typeLabel}`,
      expText,
      compensationText,
      billRateText,
      skillsText,
      descriptionSnippet,
      ``,
      `----------------------------------------`,
      `👉 APPLY FOR THIS JOB DIRECTLY HERE:`,
      applyUrl,
      `----------------------------------------`,
      `Click the link above to submit your application and resume directly to our recruitment team. Fast 48-hour review guaranteed.`,
      ``,
      hashtags,
    ]
      .filter((line) => line !== undefined && line !== null && line !== "")
      .join("\n");
  }
}
