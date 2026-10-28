import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityType, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DealDocumentStorageService } from "./deal-document-storage.service";
import type { RequestUser } from "../../common/types/request-user.type";

const documentSelect = {
  id: true,
  dealId: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  note: true,
  createdAt: true,
  uploader: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

@Injectable()
export class DealDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: DealDocumentStorageService,
  ) {}

  async findAll(dealId: string) {
    await this.getDealOrThrow(dealId);
    return this.prisma.dealDocument.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      select: documentSelect,
    });
  }

  async create(
    dealId: string,
    file: Express.Multer.File,
    note: string | undefined,
    user: RequestUser,
  ) {
    const deal = await this.getDealOrThrow(dealId);
    this.assertCanMutate(deal, user);

    const document = await this.prisma.dealDocument.create({
      data: {
        dealId,
        originalName: file.originalname,
        storagePath: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        note: note?.trim() || null,
        uploaderId: user.id,
      },
      select: documentSelect,
    });

    // Leaves a trail in the same activity log as everything else on the deal,
    // so "when did we send the proposal" is answerable from one place.
    await this.prisma.activity.create({
      data: {
        type: ActivityType.SYSTEM,
        content: `Proposal attached: ${file.originalname}`,
        dealId,
        creatorId: user.id,
      },
    });

    return document;
  }

  async download(id: string) {
    const document = await this.prisma.dealDocument.findUnique({
      where: { id },
      select: { storagePath: true, originalName: true, mimeType: true },
    });
    if (!document) {
      throw new NotFoundException("Document not found");
    }
    return { ...document, buffer: await this.storage.read(document.storagePath) };
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const document = await this.prisma.dealDocument.findUnique({
      where: { id },
      select: { storagePath: true, dealId: true, uploaderId: true },
    });
    if (!document) {
      throw new NotFoundException("Document not found");
    }
    const deal = await this.getDealOrThrow(document.dealId);
    // Deliberately narrower than uploading: whoever attached it, or someone
    // who could edit the deal anyway.
    if (document.uploaderId !== user.id) {
      this.assertCanMutate(deal, user);
    }

    await this.storage.delete(document.storagePath);
    await this.prisma.dealDocument.delete({ where: { id } });
  }

  private async getDealOrThrow(dealId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true, departmentId: true },
    });
    if (!deal) {
      throw new NotFoundException("Deal not found");
    }
    return deal;
  }

  // Mirrors DealsService.assertCanMutate: the owner, an Admin, or a Manager
  // of the deal's own department.
  private assertCanMutate(
    deal: { ownerId: string; departmentId: string | null },
    user: RequestUser,
  ) {
    if (user.role.name === RoleName.ADMIN) return;
    if (deal.ownerId === user.id) return;
    if (
      user.role.name === RoleName.MANAGER &&
      (deal.departmentId === null || deal.departmentId === user.department?.id)
    ) {
      return;
    }
    throw new ForbiddenException("You do not have permission to change this deal's documents");
  }
}
