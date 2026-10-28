import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";
import { InboundLeadDto } from "./dto/inbound-lead.dto";
import { sendEmail, hasHttpMailProvider } from "../../common/utils/mailer";
import type { RequestUser } from "../../common/types/request-user.type";

const leadInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.lead.findMany({
      include: leadInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id }, include: leadInclude });
    if (!lead) {
      throw new NotFoundException("Lead not found");
    }
    return lead;
  }

  create(dto: CreateLeadDto, creator: RequestUser) {
    return this.prisma.lead.create({
      data: {
        name: dto.name,
        company: dto.company,
        email: dto.email,
        notes: dto.notes,
        status: dto.status,
        source: dto.source,
        website: dto.website,
        contactNumber: dto.contactNumber,
        businessUnit: dto.businessUnit,
        zipCode: dto.zipCode,
        createdById: creator.id,
        lastActivityAt: new Date(),
      },
      include: leadInclude,
    });
  }

  async createInboundLead(dto: InboundLeadDto) {
    // 1. Anti-spam honeypot defense: silently succeed if a bot fills the trap field
    if (dto.honeypot && dto.honeypot.trim().length > 0) {
      return { success: true, message: "Inquiry received successfully." };
    }

    // 2. Resolve default CRM user for unauthenticated public leads
    const defaultUser =
      (await this.prisma.user.findFirst({
        where: { department: { name: "Recruitment" }, isActive: true },
        orderBy: { createdAt: "asc" },
      })) ||
      (await this.prisma.user.findFirst({
        where: { role: { name: RoleName.ADMIN }, isActive: true },
        orderBy: { createdAt: "asc" },
      })) ||
      (await this.prisma.user.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      }));

    if (!defaultUser) {
      throw new Error("No active CRM user found to attribute inbound lead to.");
    }

    const contactNum = dto.contactNumber || dto.phone || null;
    const notesText = dto.notes || dto.message || null;

    const lead = await this.prisma.lead.create({
      data: {
        name: dto.name,
        company: dto.company || null,
        email: dto.email || null,
        contactNumber: contactNum,
        website: dto.website || null,
        source: dto.source || "Website Contact Form",
        status: "New",
        businessUnit: dto.businessUnit || "Venus Consultancy",
        notes: notesText,
        gclid: dto.gclid || null,
        wbraid: dto.wbraid || null,
        gbraid: dto.gbraid || null,
        utmSource: dto.utmSource || null,
        utmMedium: dto.utmMedium || null,
        utmCampaign: dto.utmCampaign || null,
        utmTerm: dto.utmTerm || null,
        utmContent: dto.utmContent || null,
        landingPage: dto.landingPage || null,
        createdById: defaultUser.id,
        lastActivityAt: new Date(),
      },
      include: leadInclude,
    });

    // 3. Send automated email notification to recruitment manager / team
    try {
      if (hasHttpMailProvider() || defaultUser.email) {
        const leadSubject = `New Inbound Lead: ${dto.name}${dto.company ? ` from ${dto.company}` : ""}`;
        const leadHtml = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background: #ffffff;">
            <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 16px;">
              <h2 style="color: #1e3a8a; margin: 0; font-size: 20px;">New Inbound Website Lead</h2>
              <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Received via Website Form &bull; Venus CRM</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 8px 0; color: #64748b; width: 140px;"><strong>Name:</strong></td><td style="padding: 8px 0; color: #0f172a;">${dto.name}</td></tr>
              ${dto.company ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>Company:</strong></td><td style="padding: 8px 0; color: #0f172a;">${dto.company}</td></tr>` : ""}
              ${dto.email ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>Email:</strong></td><td style="padding: 8px 0; color: #0f172a;"><a href="mailto:${dto.email}">${dto.email}</a></td></tr>` : ""}
              ${contactNum ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>Phone:</strong></td><td style="padding: 8px 0; color: #0f172a;">${contactNum}</td></tr>` : ""}
              ${dto.website ? `<tr><td style="padding: 8px 0; color: #64748b;"><strong>Website:</strong></td><td style="padding: 8px 0; color: #0f172a;">${dto.website}</td></tr>` : ""}
              <tr><td style="padding: 8px 0; color: #64748b;"><strong>Source:</strong></td><td style="padding: 8px 0; color: #0f172a;">${dto.source || "Website Contact Form"}</td></tr>
            </table>
            ${notesText ? `
              <div style="margin-top: 16px; padding: 12px; background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <strong style="color: #334155; display: block; margin-bottom: 4px;">Inquiry / Message:</strong>
                <p style="margin: 0; color: #475569; white-space: pre-wrap;">${notesText}</p>
              </div>
            ` : ""}
            <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
              This is an automated notification from your Venus CRM platform.
            </div>
          </div>
        `;

        if (defaultUser.email) {
          await sendEmail({
            to: defaultUser.email,
            subject: leadSubject,
            html: leadHtml,
          });
        }
      }
    } catch (err) {
      console.warn("Failed to send inbound lead notification email:", err);
    }

    return {
      success: true,
      message: "Lead received and saved to CRM successfully",
      leadId: lead.id,
    };
  }

  async update(id: string, dto: UpdateLeadDto, user: RequestUser) {
    const lead = await this.getOwned(id);
    this.assertCanMutate(lead, user);

    return this.prisma.lead.update({
      where: { id },
      data: {
        name: dto.name,
        company: dto.company,
        email: dto.email,
        notes: dto.notes,
        status: dto.status,
        source: dto.source,
        website: dto.website,
        contactNumber: dto.contactNumber,
        businessUnit: dto.businessUnit,
        zipCode: dto.zipCode,
        // Any edit counts as activity on the lead -- same idea as bumping
        // updatedAt, but exposed as its own field since the UI displays
        // "last activity" distinctly from "modified on".
        lastActivityAt: new Date(),
      },
      include: leadInclude,
    });
  }

  async remove(id: string, user: RequestUser): Promise<void> {
    const lead = await this.getOwned(id);
    this.assertCanMutate(lead, user);
    await this.prisma.lead.delete({ where: { id } });
  }

  private async getOwned(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      throw new NotFoundException("Lead not found");
    }
    return lead;
  }

  private assertCanMutate(lead: { createdById: string }, user: RequestUser) {
    if (user.role.name === RoleName.ADMIN) return;
    if (lead.createdById !== user.id) {
      throw new ForbiddenException("You do not have permission to modify this lead");
    }
  }
}
