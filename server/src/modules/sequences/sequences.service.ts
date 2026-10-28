import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EnrollmentStatus, RoleName, SendStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSequenceDto } from "./dto/create-sequence.dto";
import { UpdateSequenceDto } from "./dto/update-sequence.dto";
import { CreateSequenceStepDto } from "./dto/create-sequence-step.dto";
import { UpdateSequenceStepDto } from "./dto/update-sequence-step.dto";
import { EnrollContactsDto } from "./dto/enroll-contacts.dto";
import { canUseSalesOrRecruitment } from "../../common/utils/sales-access";
import { followUpColdSince } from "../../common/utils/follow-up";
import { EmailConnectionsService } from "../email-connections/email-connections.service";
import { EngagementEventsService } from "../engagement/engagement-events.service";
import type { RequestUser } from "../../common/types/request-user.type";

const stepInclude = {
  template: { select: { id: true, name: true, subject: true } },
} as const;

const sequenceInclude = {
  creator: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  steps: { include: stepInclude, orderBy: { order: "asc" } },
  _count: { select: { enrollments: true } },
} as const;

const enrollmentInclude = {
  contact: { select: { id: true, firstName: true, lastName: true, email: true } },
  enrolledBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

@Injectable()
export class SequencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailConnections: EmailConnectionsService,
    private readonly engagementEvents: EngagementEventsService,
  ) {}

  findAll(user: RequestUser) {
    this.assertCanUse(user);
    return this.prisma.sequence.findMany({
      include: sequenceInclude,
      orderBy: { updatedAt: "desc" },
    });
  }

  async findOne(id: string, user: RequestUser) {
    this.assertCanUse(user);
    const sequence = await this.prisma.sequence.findUnique({
      where: { id },
      include: {
        ...sequenceInclude,
        enrollments: { include: enrollmentInclude, orderBy: { createdAt: "desc" } },
      },
    });
    if (!sequence) {
      throw new NotFoundException("Sequence not found");
    }
    return sequence;
  }

  create(dto: CreateSequenceDto, user: RequestUser) {
    this.assertCanUse(user);
    return this.prisma.sequence.create({
      data: {
        name: dto.name,
        description: dto.description,
        creatorId: user.id,
        departmentId: user.department?.id,
      },
      include: sequenceInclude,
    });
  }

  async update(id: string, dto: UpdateSequenceDto, user: RequestUser) {
    this.assertCanUse(user);
    await this.getOwnedSequence(id);
    return this.prisma.sequence.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        followUpMode: dto.followUpMode,
      },
      include: sequenceInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    this.assertCanUse(user);
    await this.getOwnedSequence(id);
    await this.prisma.sequence.delete({ where: { id } });
  }

  // --- steps ---

  async addStep(sequenceId: string, dto: CreateSequenceStepDto, user: RequestUser) {
    this.assertCanUse(user);
    await this.getOwnedSequence(sequenceId);

    const last = await this.prisma.sequenceStep.findFirst({
      where: { sequenceId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const order = (last?.order ?? -1) + 1;

    return this.prisma.sequenceStep.create({
      data: { sequenceId, templateId: dto.templateId, delayDays: dto.delayDays, order },
      include: stepInclude,
    });
  }

  async updateStep(
    sequenceId: string,
    stepId: string,
    dto: UpdateSequenceStepDto,
    user: RequestUser,
  ) {
    this.assertCanUse(user);
    await this.getOwnedSequence(sequenceId);
    await this.getOwnedStep(sequenceId, stepId);

    return this.prisma.sequenceStep.update({
      where: { id: stepId },
      data: { templateId: dto.templateId, delayDays: dto.delayDays },
      include: stepInclude,
    });
  }

  async removeStep(sequenceId: string, stepId: string, user: RequestUser): Promise<void> {
    this.assertCanUse(user);
    await this.getOwnedSequence(sequenceId);
    await this.getOwnedStep(sequenceId, stepId);
    await this.prisma.sequenceStep.delete({ where: { id: stepId } });
  }

  // --- enrollment ---

  async enroll(sequenceId: string, dto: EnrollContactsDto, user: RequestUser) {
    this.assertCanUse(user);
    await this.assertSenderConnected(user);
    await this.getOwnedSequence(sequenceId);

    const firstStep = await this.prisma.sequenceStep.findFirst({
      where: { sequenceId },
      orderBy: { order: "asc" },
    });
    if (!firstStep) {
      throw new BadRequestException("Add at least one step before enrolling contacts.");
    }

    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: dto.contactIds } },
      select: { id: true, email: true },
    });

    const results: Array<{ contactId: string; enrolled: boolean; reason?: string }> = [];
    for (const contactId of dto.contactIds) {
      const contact = contacts.find((c) => c.id === contactId);
      if (!contact) {
        results.push({ contactId, enrolled: false, reason: "Contact not found" });
        continue;
      }
      if (!contact.email) {
        results.push({ contactId, enrolled: false, reason: "Contact has no email address" });
        continue;
      }
      const existing = await this.prisma.sequenceEnrollment.findUnique({
        where: { sequenceId_contactId: { sequenceId, contactId } },
      });
      if (existing) {
        results.push({ contactId, enrolled: false, reason: "Already enrolled in this sequence" });
        continue;
      }

      await this.prisma.sequenceEnrollment.create({
        data: {
          sequenceId,
          contactId,
          enrolledById: user.id,
          currentStepOrder: firstStep.order,
          nextSendAt: addDays(new Date(), firstStep.delayDays),
        },
      });
      await this.engagementEvents.record({
        type: "SEQUENCE_STARTED",
        contactId,
        sequenceId,
        ownerId: user.id,
      });
      results.push({ contactId, enrolled: true });
    }
    return results;
  }

  async stopEnrollment(
    sequenceId: string,
    enrollmentId: string,
    reason: string | undefined,
    user: RequestUser,
  ) {
    this.assertCanUse(user);
    await this.getOwnedSequence(sequenceId);
    const enrollment = await this.prisma.sequenceEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment || enrollment.sequenceId !== sequenceId) {
      throw new NotFoundException("Enrollment not found");
    }

    return this.prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: EnrollmentStatus.STOPPED, stoppedReason: reason ?? "Stopped manually" },
      include: enrollmentInclude,
    });
  }

  // --- activity feed (recent sends across every Sales-visible sequence) ---

  async recentActivity(user: RequestUser) {
    this.assertCanUse(user);
    return this.prisma.sequenceSend.findMany({
      include: {
        step: { select: { id: true, template: { select: { name: true } } } },
        enrollment: {
          select: {
            id: true,
            sequence: { select: { id: true, name: true } },
            contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { sentAt: "desc" },
      take: 100,
    });
  }

  // Mirrors BulkEmailService.findFollowUps -- same "cold" definition (see
  // common/utils/follow-up.ts) so the two channels feed one consistent
  // Follow-Up Reminders view instead of sequences (a major outreach
  // channel) being invisible to it entirely.
  async findFollowUps(user: RequestUser) {
    this.assertCanUse(user);
    const coldDate = followUpColdSince();

    return this.prisma.sequenceSend.findMany({
      where: {
        status: SendStatus.SENT,
        openCount: 0,
        sentAt: { lte: coldDate },
        dismissedAt: null,
        enrollment: user.role.name === RoleName.EMPLOYEE ? { enrolledById: user.id } : undefined,
      },
      include: {
        step: { select: { id: true, template: { select: { name: true } } } },
        enrollment: {
          select: {
            id: true,
            sequence: { select: { id: true, name: true } },
            contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { sentAt: "desc" },
    });
  }

  // Mirrors BulkEmailService.dismissFollowUp -- same "handled it some other
  // way" escape hatch, same visibility-matched permission check.
  async dismissFollowUp(id: string, user: RequestUser): Promise<void> {
    this.assertCanUse(user);
    const send = await this.prisma.sequenceSend.findUnique({
      where: { id },
      select: { enrollment: { select: { enrolledById: true } } },
    });
    if (!send) {
      throw new NotFoundException("Follow-up not found");
    }
    if (user.role.name === RoleName.EMPLOYEE && send.enrollment.enrolledById !== user.id) {
      throw new ForbiddenException("You can only dismiss your own follow-ups");
    }
    await this.prisma.sequenceSend.update({
      where: { id },
      data: { dismissedAt: new Date() },
    });
  }

  private async getOwnedSequence(id: string) {
    const sequence = await this.prisma.sequence.findUnique({ where: { id } });
    if (!sequence) {
      throw new NotFoundException("Sequence not found");
    }
    return sequence;
  }

  private async getOwnedStep(sequenceId: string, stepId: string) {
    const step = await this.prisma.sequenceStep.findUnique({ where: { id: stepId } });
    if (!step || step.sequenceId !== sequenceId) {
      throw new NotFoundException("Sequence step not found");
    }
    return step;
  }

  // Same collaborative Sales-team ownership as EmailTemplate -- any Sales
  // member (or Admin) can manage any sequence.
  private assertCanUse(user: RequestUser) {
    if (!canUseSalesOrRecruitment(user)) {
      throw new ForbiddenException("Sequences are only available to the Sales and Recruitment departments");
    }
  }

  // Steps send from whoever enrolled the contact (enrolledById), not a
  // shared company sender -- no point enrolling someone into a drip they'll
  // never actually receive because the enroller's mailbox isn't connected.
  // The shared HTTP stopgap also counts as "ready to send" -- see
  // EmailConnectionsService.requireSendable.
  private async assertSenderConnected(user: RequestUser) {
    const status = await this.emailConnections.getStatus(user);
    if (status.connected && status.verified) return;
    if (this.emailConnections.hasHttpFallback()) return;
    throw new BadRequestException(
      "Connect and verify your email account in your profile before enrolling contacts in a sequence.",
    );
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
