import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CandidateStage, OfferStatus, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { UpdateOfferDto } from "./dto/update-offer.dto";
import type { RequestUser } from "../../common/types/request-user.type";

const offerInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  candidate: { select: { id: true, firstName: true, lastName: true, jobPostingId: true } },
} as const;

interface OfferFilters {
  candidateId?: string;
  status?: OfferStatus;
  departmentId?: string;
}

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: OfferFilters, user: RequestUser) {
    return this.prisma.offer.findMany({
      where: {
        candidateId: filters.candidateId,
        status: filters.status,
        ...this.visibilityScope(user, filters.departmentId),
      },
      include: offerInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  private visibilityScope(user: RequestUser, requestedDepartmentId?: string) {
    if (user.role.name === RoleName.ADMIN) {
      return requestedDepartmentId ? { departmentId: requestedDepartmentId } : {};
    }
    return { OR: [{ departmentId: null }, { departmentId: user.department?.id }] };
  }

  async findOne(id: string, user: RequestUser) {
    const offer = await this.prisma.offer.findUnique({ where: { id }, include: offerInclude });
    if (!offer) {
      throw new NotFoundException("Offer not found");
    }
    this.assertCanAccess(offer, user);
    return offer;
  }

  async create(dto: CreateOfferDto, creator: RequestUser) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id: dto.candidateId } });
    if (!candidate) {
      throw new NotFoundException("Candidate not found");
    }

    const status = dto.status ?? OfferStatus.DRAFT;
    return this.prisma.offer.create({
      data: {
        candidateId: dto.candidateId,
        createdById: creator.id,
        salary: dto.salary,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        status,
        notes: dto.notes,
        departmentId: candidate.departmentId,
        sentAt: status === OfferStatus.SENT ? new Date() : undefined,
        placementCode: dto.placementCode,
        placementType: dto.placementType,
        clientPrimeVendor: dto.clientPrimeVendor,
        businessUnit: dto.businessUnit,
        clientBillRate: dto.clientBillRate,
        payRate: dto.payRate,
        perDiemHr: dto.perDiemHr,
        overhead: dto.overhead,
        margin: dto.margin,
      },
      include: offerInclude,
    });
  }

  // Accepting/declining an offer also drives the candidate's own pipeline
  // stage -- an accepted offer means the candidate is HIRED, a declined one
  // means the process ended without a hire. Both writes happen in one
  // transaction so the two records never disagree.
  async update(id: string, dto: UpdateOfferDto, user: RequestUser) {
    const offer = await this.getOwned(id);
    this.assertCanMutate(offer, user);

    const statusChanged = dto.status !== undefined && dto.status !== offer.status;
    const now = new Date();

    const [updated] = await this.prisma.$transaction([
      this.prisma.offer.update({
        where: { id },
        data: {
          salary: dto.salary,
          startDate: dto.startDate === undefined ? undefined : dto.startDate ? new Date(dto.startDate) : null,
          status: dto.status,
          notes: dto.notes,
          placementCode: dto.placementCode,
          placementType: dto.placementType,
          clientPrimeVendor: dto.clientPrimeVendor,
          businessUnit: dto.businessUnit,
          clientBillRate: dto.clientBillRate,
          payRate: dto.payRate,
          perDiemHr: dto.perDiemHr,
          overhead: dto.overhead,
          margin: dto.margin,
          sentAt: statusChanged && dto.status === OfferStatus.SENT ? now : undefined,
          respondedAt:
            statusChanged && (dto.status === OfferStatus.ACCEPTED || dto.status === OfferStatus.DECLINED)
              ? now
              : undefined,
        },
        include: offerInclude,
      }),
      ...(statusChanged && dto.status === OfferStatus.ACCEPTED
        ? [
            this.prisma.candidate.update({
              where: { id: offer.candidateId },
              data: { stage: CandidateStage.HIRED, closedAt: now },
            }),
          ]
        : statusChanged && dto.status === OfferStatus.DECLINED
          ? [
              this.prisma.candidate.update({
                where: { id: offer.candidateId },
                data: { stage: CandidateStage.REJECTED, closedAt: now, rejectionReason: "Candidate declined offer" },
              }),
            ]
          : []),
    ]);

    return updated;
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const offer = await this.getOwned(id);
    this.assertCanMutate(offer, user);
    await this.prisma.offer.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) {
      throw new NotFoundException("Offer not found");
    }
    return offer;
  }

  private assertCanAccess(offer: { departmentId: string | null }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    if (!isAdmin && offer.departmentId !== null && offer.departmentId !== user.department?.id) {
      throw new ForbiddenException("You do not have access to this offer");
    }
  }

  private assertCanMutate(offer: { departmentId: string | null; createdById: string }, user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isCreator = offer.createdById === user.id;
    const isDeptManager =
      user.role.name === RoleName.MANAGER &&
      (offer.departmentId === null || offer.departmentId === user.department?.id);
    if (!isAdmin && !isCreator && !isDeptManager) {
      throw new ForbiddenException("You do not have permission to modify this offer");
    }
  }
}
