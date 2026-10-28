import { Injectable, NotFoundException } from "@nestjs/common";
import { LeadSource } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";
import { ImportContactsDto } from "./dto/import-contacts.dto";
import { inferCompanyFromEmail } from "../../common/utils/merge-fields";
import type { RequestUser } from "../../common/types/request-user.type";

// Used for both list and detail views -- just the fields every row needs.
const contactListInclude = {
  company: { select: { id: true, name: true } },
} as const;

// Detail-only: the "Email History" panel needs each contact's full
// bulk-email/sequence send history, but that's a meaningfully heavier join
// (recipients + enrollments + nested sends) that every row of the contact
// list was paying for even though only one contact's detail sheet is ever
// open at a time. findOne uses this; findAll uses the lighter include above.
const contactDetailInclude = {
  ...contactListInclude,
  bulkEmailRecipients: {
    select: {
      id: true,
      status: true,
      openedAt: true,
      openCount: true,
      campaign: { select: { name: true } },
      sentAt: true,
    },
    orderBy: { sentAt: "desc" },
  },
  sequenceEnrollments: {
    select: {
      id: true,
      status: true,
      sequence: { select: { name: true } },
      sends: {
        select: {
          id: true,
          status: true,
          openedAt: true,
          openCount: true,
          sentAt: true,
        },
        orderBy: { sentAt: "desc" },
      },
    },
  },
} as const;

const importBatchInclude = {
  importedBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

// Placeholder values seen in real-world exports (e.g. LinkedIn hides a
// contact's employer behind "Not shown" unless you're connected) -- treat
// these as "no company" rather than creating junk Company rows for them.
const PLACEHOLDER_COMPANY_NAMES = new Set(["not shown", "n/a", "na", "none", "-", "unknown"]);

function normalizeEmail(raw: string | undefined): string | undefined {
  const email = raw?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return undefined;
  }
  return email;
}

function cleanString(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  return value ? value : undefined;
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: { companyId?: string }) {
    return this.prisma.contact.findMany({
      where: { companyId: filters.companyId },
      include: contactListInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id }, include: contactDetailInclude });
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }
    return contact;
  }

  async create(dto: CreateContactDto) {
    if (dto.companyId) {
      await this.assertCompanyExists(dto.companyId);
    }

    return this.prisma.contact.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        title: dto.title,
        companyId: dto.companyId,
        location: dto.location,
        website: dto.website,
        linkedinUrl: dto.linkedinUrl,
        category: dto.category,
        priority: dto.priority,
        notes: dto.notes,
      },
      include: contactListInclude,
    });
  }

  async update(id: string, dto: UpdateContactDto) {
    await this.getOwned(id);
    if (dto.companyId) {
      await this.assertCompanyExists(dto.companyId);
    }

    return this.prisma.contact.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        title: dto.title,
        companyId: dto.companyId,
        location: dto.location,
        website: dto.website,
        linkedinUrl: dto.linkedinUrl,
        category: dto.category,
        priority: dto.priority,
        notes: dto.notes,
      },
      include: contactListInclude,
    });
  }

  async remove(id: string) {
    await this.getOwned(id);
    await this.prisma.contact.delete({ where: { id } });
  }

  // Rows come from a spreadsheet a human exported/mapped client-side (see
  // contact-import-dialog.tsx) -- one bad row must never fail the whole
  // batch, so every per-row problem (unparseable email, entirely blank row)
  // is a skip, not a thrown error. Dedupes against existing contacts by
  // email: a repeat import of the same sheet updates rather than
  // duplicates. Rows with no email always create a new contact since there's
  // no reliable key to match them against.
  async importBatch(dto: ImportContactsDto, user: RequestUser) {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of dto.rows) {
      const firstName = cleanString(row.firstName);
      const lastName = cleanString(row.lastName);
      const email = normalizeEmail(row.email);

      if (!firstName && !lastName && !email) {
        skipped++;
        continue;
      }

      const companyId = await this.resolveCompanyId(
        cleanString(row.companyName) || inferCompanyFromEmail(email),
      );
      const phone = cleanString(row.phone);
      const title = cleanString(row.title);
      const linkedinUrl = cleanString(row.linkedinUrl);
      const notes = cleanString(row.notes);
      const location = cleanString(row.location);
      const website = cleanString(row.website);
      const category = cleanString(row.category);
      const priority = cleanString(row.priority);

      if (email) {
        const existing = await this.prisma.contact.findFirst({ where: { email } });
        if (existing) {
          await this.prisma.contact.update({
            where: { id: existing.id },
            data: {
              firstName: firstName ?? existing.firstName,
              lastName: lastName ?? existing.lastName,
              phone: phone ?? existing.phone,
              title: title ?? existing.title,
              linkedinUrl: linkedinUrl ?? existing.linkedinUrl,
              notes: notes ?? existing.notes,
              companyId: companyId ?? existing.companyId,
              location: location ?? existing.location,
              website: website ?? existing.website,
              category: category ?? existing.category,
              priority: priority ?? existing.priority,
            },
          });
          updated++;
          continue;
        }
      }

      await this.prisma.contact.create({
        data: {
          firstName: firstName ?? "Unknown",
          lastName: lastName ?? "",
          email,
          phone,
          title,
          linkedinUrl,
          notes,
          companyId,
          location,
          website,
          category,
          priority,
          source: LeadSource.IMPORT,
        },
      });
      created++;
    }

    return this.prisma.contactImportBatch.create({
      data: {
        fileName: dto.fileName,
        importedById: user.id,
        totalRows: dto.rows.length,
        createdCount: created,
        updatedCount: updated,
        skippedCount: skipped,
      },
      include: importBatchInclude,
    });
  }

  listImportBatches() {
    return this.prisma.contactImportBatch.findMany({
      include: importBatchInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  private async resolveCompanyId(companyName: string | undefined): Promise<string | undefined> {
    const name = cleanString(companyName);
    if (!name || PLACEHOLDER_COMPANY_NAMES.has(name.toLowerCase())) {
      return undefined;
    }
    const company = await this.prisma.company.upsert({
      where: { name },
      create: { name, source: LeadSource.IMPORT },
      update: {},
    });
    return company.id;
  }

  private async getOwned(id: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }
    return contact;
  }

  private async assertCompanyExists(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException("Company not found");
    }
  }
}
