import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailConnectionsService } from "../email-connections/email-connections.service";
import { EmailOAuthService } from "../email-oauth/email-oauth.service";
import { EmailSyncEngineService } from "../email-oauth/email-sync-engine.service";
import { sendEmail, hasHttpMailProvider } from "../../common/utils/mailer";

export interface ApplicationNotificationPayload {
  candidateId: string;
  jobPostingId: string;
}

@Injectable()
export class CandidateNotificationService {
  private readonly logger = new Logger(CandidateNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailConnections: EmailConnectionsService,
    private readonly emailOAuth: EmailOAuthService,
    @Optional() private readonly emailSyncEngine?: EmailSyncEngineService,
  ) {}

  /**
   * Automatically notifies the Recruitment Manager and Assigned Recruiter
   * whenever an applicant or candidate form is submitted (via Careers portal or ATS).
   */
  async notifyTeamOnApplication(payload: ApplicationNotificationPayload): Promise<void> {
    try {
      const candidate = await this.prisma.candidate.findUnique({
        where: { id: payload.candidateId },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });

      if (!candidate) {
        this.logger.warn(`Cannot send application notification: candidate ${payload.candidateId} not found`);
        return;
      }

      const posting = await this.prisma.jobPosting.findUnique({
        where: { id: payload.jobPostingId },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          department: { select: { id: true, name: true, headId: true } },
        },
      });

      if (!posting) {
        this.logger.warn(`Cannot send application notification: job posting ${payload.jobPostingId} not found`);
        return;
      }

      // 1. Resolve Recruitment Manager Official Email
      const managerEmail = await this.resolveRecruitmentManagerEmail(posting);

      // 2. Resolve Assigned Recruiter Official Email
      const recruiterEmail = await this.resolveAssignedRecruiterEmail(posting, candidate);

      // 3. Compile unique recipient emails list
      const recipients = Array.from(
        new Set([managerEmail, recruiterEmail].map((e) => e?.trim().toLowerCase()).filter(Boolean)),
      ) as string[];

      if (recipients.length === 0) {
        this.logger.warn(`No recipient email resolved for requisition ${posting.title} (${posting.id})`);
        return;
      }

      this.logger.log(
        `Dispatching automated applicant notification for "${candidate.firstName} ${candidate.lastName}" to: ${recipients.join(", ")}`,
      );

      // 4. Build email content
      const subject = `[New Application] ${candidate.firstName} ${candidate.lastName} - ${posting.title} (${posting.jobCode || "REQ"})`;
      const html = this.buildNotificationHtml(candidate, posting, managerEmail, recruiterEmail);
      const text = this.buildNotificationPlainText(candidate, posting);

      // 5. Send via the best available sender connection
      await this.dispatchEmail(recipients, subject, html, text, posting.ownerId || candidate.ownerId);
    } catch (err: any) {
      // Must never crash candidate creation even if mail sending encounters an error
      this.logger.error(`Failed sending applicant team notification: ${err?.message || err}`, err?.stack);
    }
  }

  private async resolveRecruitmentManagerEmail(posting: any): Promise<string> {
    const rawMgr = (posting.recruitmentManager || "").trim();

    // If explicit email provided in job posting
    if (rawMgr && rawMgr.includes("@")) {
      return rawMgr;
    }

    // If manager name is given, look up in User roster
    if (rawMgr) {
      const parts = rawMgr.split(" ").filter(Boolean);
      const matchedUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: rawMgr, mode: "insensitive" } },
            { firstName: { equals: parts[0], mode: "insensitive" } },
          ],
        },
        select: { email: true },
      });
      if (matchedUser?.email) {
        return matchedUser.email;
      }
    }

    // Try finding the head of the Recruitment Department in DB
    const recDept = await this.prisma.department.findFirst({
      where: { name: { equals: "Recruitment", mode: "insensitive" } },
      include: { head: { select: { email: true } } },
    });
    if (recDept?.head?.email) {
      return recDept.head.email;
    }

    // If posting owner is available
    if (posting.owner?.email) {
      return posting.owner.email;
    }

    // Standard official fallback
    return process.env.RECRUITMENT_MANAGER_EMAIL || "megan@venushiring.ca";
  }

  private async resolveAssignedRecruiterEmail(posting: any, candidate: any): Promise<string | undefined> {
    const rawAssigned = (posting.assignedTo || "").trim();

    // If explicit email provided
    if (rawAssigned && rawAssigned.includes("@")) {
      return rawAssigned;
    }

    // If recruiter name is given, look up in User roster
    if (rawAssigned) {
      const parts = rawAssigned.split(" ").filter(Boolean);
      const matchedUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: rawAssigned, mode: "insensitive" } },
            { firstName: { equals: parts[0], mode: "insensitive" } },
            { lastName: { equals: parts[parts.length - 1], mode: "insensitive" } },
          ],
        },
        select: { email: true },
      });
      if (matchedUser?.email) {
        return matchedUser.email;
      }
    }

    // If candidate has an assigned recruiter owner
    if (candidate.owner?.email) {
      return candidate.owner.email;
    }

    return undefined;
  }

  private async dispatchEmail(
    recipients: string[],
    subject: string,
    html: string,
    text: string,
    preferredUserId?: string,
  ): Promise<void> {
    const recipientStr = recipients.join(", ");
    let sendable: any = null;
    let senderUserId = preferredUserId;

    // Attempt to locate a sendable account from preferred user or verified system connection
    if (senderUserId) {
      sendable = await this.emailConnections.requireSendable(senderUserId).catch(() => null);
    }

    if (!sendable) {
      // Find any verified admin / manager connection in system
      const verifiedConn = await this.prisma.userEmailConnection.findFirst({
        where: { verified: true },
        orderBy: { updatedAt: "desc" },
      });
      if (verifiedConn) {
        senderUserId = verifiedConn.userId;
        sendable = await this.emailConnections.requireSendable(verifiedConn.userId).catch(() => null);
      }
    }

    let providerMessageId: string | undefined;

    if (sendable && sendable.mode === "smtp") {
      const info = await sendable.transporter.sendMail({
        from: sendable.from,
        to: recipientStr,
        subject,
        html,
        text,
      });
      providerMessageId = (info as any)?.messageId;

      // Append to the connected mail ID's platform (e.g. Zoho Mail Sent folder)
      if (this.emailSyncEngine && senderUserId) {
        await this.emailSyncEngine
          .appendSentMessage(senderUserId, {
            from: sendable.from,
            to: recipientStr,
            subject,
            html,
            text,
            messageId: providerMessageId,
          })
          .catch((err) => {
            this.logger.warn(`Failed to append sent application notification to IMAP: ${err}`);
          });
      }
    } else if (sendable && sendable.mode === "oauth") {
      const sent = await this.emailOAuth.sendMail(sendable.provider, sendable.accessToken, {
        to: recipientStr,
        subject,
        html,
        from: sendable.from,
      });
      providerMessageId = sent?.messageId;
    } else if (hasHttpMailProvider()) {
      const result = await sendEmail({
        to: recipientStr,
        subject,
        html,
        text,
        replyTo: sendable?.replyTo,
      });
      if (!result.delivered) {
        this.logger.warn(`HTTP mail provider send warning: ${result.error}`);
      }
    } else {
      // Dev mode: logs email for local inspection
      this.logger.log(`[Dev Mail Log] Notification to ${recipientStr} | Subject: "${subject}"`);
    }

    // Record into SyncedEmail table so it appears in the CRM "Sent" panel
    if (this.emailSyncEngine && senderUserId) {
      await this.emailSyncEngine
        .recordSentEmail({
          userId: senderUserId,
          fromAddress: sendable && "from" in sendable ? sendable.from : "noreply@venushiring.ca",
          toAddresses: recipients,
          subject,
          bodyHtml: html,
          bodyText: text,
          providerMessageId,
        })
        .catch((err) => {
          this.logger.warn(`Failed recording applicant notification in SyncedEmail: ${err}`);
        });
    }
  }

  private buildNotificationHtml(candidate: any, posting: any, managerEmail: string, recruiterEmail?: string): string {
    const appUrl = (process.env.APP_URL || process.env.CORS_ORIGIN || "http://localhost:8080").replace(/\/$/, "");
    const viewUrl = `${appUrl}/recruitment?tab=applicants`;
    const candName = `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim() || "Applicant";
    const candLoc = [candidate.city, candidate.state].filter(Boolean).join(", ") || "Location not provided";
    const skillsList = Array.isArray(candidate.skills)
      ? candidate.skills.join(", ")
      : typeof candidate.skills === "string"
        ? candidate.skills
        : "N/A";
    const expText = candidate.totalExperienceYears
      ? `${candidate.totalExperienceYears} Years`
      : "Not specified";
    const resumeDownload = candidate.resumeUrl
      ? candidate.resumeUrl.startsWith("http")
        ? candidate.resumeUrl
        : `${appUrl}${candidate.resumeUrl.startsWith("/") ? "" : "/"}${candidate.resumeUrl}`
      : null;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>New Applicant Notification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0b5ed7 0%, #1e40af 100%); padding: 24px; color: #ffffff; }
    .header-logo { font-size: 18px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px; }
    .header-subtitle { font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.1em; }
    .content { padding: 24px; }
    .banner { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px; }
    .banner-title { font-weight: 700; color: #1e3a8a; font-size: 14px; margin: 0 0 4px 0; }
    .banner-desc { font-size: 13px; color: #3b82f6; margin: 0; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
    .grid { display: table; width: 100%; border-collapse: collapse; }
    .grid-row { display: table-row; }
    .grid-label { display: table-cell; width: 35%; padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600; }
    .grid-value { display: table-cell; width: 65%; padding: 6px 0; font-size: 13px; color: #0f172a; font-weight: 500; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .btn-container { text-align: center; margin-top: 28px; margin-bottom: 16px; }
    .btn { display: inline-block; background: #0b5ed7; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 6px rgba(11,94,215,0.3); }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-logo">Venus Consultancy</div>
      <div class="header-subtitle">Recruitment Operating System &bull; Automatic Alert</div>
    </div>
    <div class="content">
      <div class="banner">
        <p class="banner-title">&bull; New Candidate Application Submitted</p>
        <p class="banner-desc">An applicant has applied or been registered for requisition: <strong>${posting.title}</strong></p>
      </div>

      <div class="section-title">Requisition Details</div>
      <div class="grid">
        <div class="grid-row">
          <div class="grid-label">Job Title:</div>
          <div class="grid-value"><strong>${posting.title}</strong></div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Requisition Code:</div>
          <div class="grid-value">${posting.jobCode || "N/A"}</div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Client Name:</div>
          <div class="grid-value">${posting.client || "Direct Client"}</div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Business Unit / Location:</div>
          <div class="grid-value">${[posting.businessUnit, posting.location].filter(Boolean).join(" &bull; ") || "N/A"}</div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Recruitment Manager:</div>
          <div class="grid-value">${posting.recruitmentManager || "Megan Foster"} &lt;${managerEmail}&gt;</div>
        </div>
        ${
          recruiterEmail
            ? `<div class="grid-row">
          <div class="grid-label">Assigned Recruiter:</div>
          <div class="grid-value">${posting.assignedTo || "Assigned Recruiter"} &lt;${recruiterEmail}&gt;</div>
        </div>`
            : ""
        }
      </div>

      <div class="section-title">Applicant Profile</div>
      <div class="grid">
        <div class="grid-row">
          <div class="grid-label">Candidate Name:</div>
          <div class="grid-value"><strong>${candName}</strong></div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Email Address:</div>
          <div class="grid-value"><a href="mailto:${candidate.email}" style="color: #0b5ed7;">${candidate.email}</a></div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Mobile / Phone:</div>
          <div class="grid-value">${candidate.phone || "Not provided"}</div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Location:</div>
          <div class="grid-value">${candLoc}</div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Current Role:</div>
          <div class="grid-value">${candidate.currentTitle || "N/A"}</div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Total Experience:</div>
          <div class="grid-value">${expText}</div>
        </div>
        <div class="grid-row">
          <div class="grid-label">Skills:</div>
          <div class="grid-value">${skillsList}</div>
        </div>
        ${
          candidate.aiMatchScore
            ? `<div class="grid-row">
          <div class="grid-label">AI Fit Screening:</div>
          <div class="grid-value"><span class="badge">${candidate.aiMatchScore}% Score &bull; ${candidate.fitBadge || "MATCH"}</span></div>
        </div>`
            : ""
        }
        ${
          resumeDownload
            ? `<div class="grid-row">
          <div class="grid-label">Attached Resume:</div>
          <div class="grid-value"><a href="${resumeDownload}" target="_blank" style="color: #0b5ed7; font-weight: 700;">Download / View Attached Resume &rarr;</a></div>
        </div>`
            : ""
        }
        <div class="grid-row">
          <div class="grid-label">Source:</div>
          <div class="grid-value">${candidate.source || "Careers Portal"}</div>
        </div>
      </div>

      ${
        candidate.summary
          ? `<div class="section-title">Candidate Summary / Notes</div>
      <p style="font-size: 13px; line-height: 1.5; color: #334155; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
        ${candidate.summary}
      </p>`
          : ""
      }

      <div class="btn-container">
        <a href="${viewUrl}" class="btn">View Candidate in Venus CRM &rarr;</a>
      </div>
    </div>
    <div class="footer">
      Automated email alert from Venus Consultancy ATS.<br />
      Delivered to Recruitment Manager &amp; Assigned Recruiter.
    </div>
  </div>
</body>
</html>`;
  }

  private buildNotificationPlainText(candidate: any, posting: any): string {
    const candName = `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim() || "Applicant";
    return `[New Candidate Application Received]

Requisition: ${posting.title} (${posting.jobCode || "REQ"})
Client: ${posting.client || "Direct Client"}
Location: ${posting.location || "N/A"}

Candidate Details:
Name: ${candName}
Email: ${candidate.email}
Phone: ${candidate.phone || "N/A"}
Location: ${[candidate.city, candidate.state].filter(Boolean).join(", ") || "N/A"}
Experience: ${candidate.totalExperienceYears || "N/A"} Years
Skills: ${Array.isArray(candidate.skills) ? candidate.skills.join(", ") : candidate.skills || "N/A"}
Source: ${candidate.source || "Careers Portal"}
Resume: ${candidate.resumeUrl || "None"}

Please check your Venus CRM Recruitment dashboard:
http://localhost:8080/recruitment?tab=applicants
`;
  }
}
