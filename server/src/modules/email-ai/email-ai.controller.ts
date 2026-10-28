import { Body, Controller, Get, Post } from "@nestjs/common";
import { EmailAiService } from "./email-ai.service";
import { GenerateTemplateDto, PersonalizePreviewDto, RewriteEmailDto, SuggestSubjectsDto } from "./dto/email-ai.dto";
import { Department } from "../../common/decorators/department.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { inferCompanyFromEmail, renderMergeFields } from "../../common/utils/merge-fields";
import type { RequestUser } from "../../common/types/request-user.type";

// The AI writing helpers behind templates and campaigns: same audience as Bulk Email itself.
@Department("Sales", "Recruitment")
@Controller("email-ai")
export class EmailAiController {
  constructor(private readonly ai: EmailAiService) {}

  /** Lets the UI show or hide the AI buttons depending on whether an Admin has set the Gemini key. */
  @Get("status")
  status() {
    return { configured: this.ai.isConfigured(), provider: "Gemini" };
  }

  @Post("template")
  template(@Body() dto: GenerateTemplateDto, @CurrentUser() user: RequestUser) {
    return this.ai.generateTemplate(dto, user.id);
  }

  @Post("rewrite")
  rewrite(@Body() dto: RewriteEmailDto, @CurrentUser() user: RequestUser) {
    return this.ai.rewrite(dto, user.id);
  }

  @Post("subjects")
  subjects(@Body() dto: SuggestSubjectsDto, @CurrentUser() user: RequestUser) {
    return this.ai.suggestSubjects({ ...dto, count: dto.count ?? 4 }, user.id);
  }

  /** What one recipient's email would look like, shown before a campaign is sent. */
  @Post("personalize-preview")
  async personalizePreview(@Body() dto: PersonalizePreviewDto, @CurrentUser() user: RequestUser) {
    const r = dto.recipient;
    const merge = {
      firstName: r.firstName ?? "",
      lastName: r.lastName ?? "",
      title: r.title ?? null,
      companyName: r.companyName ?? (r.email ? inferCompanyFromEmail(r.email) : null) ?? null,
      email: r.email ?? "",
    };
    return this.ai.personalizePreview(
      {
        baseSubject: renderMergeFields(dto.subject, merge),
        baseBody: renderMergeFields(dto.body, merge),
        recipient: {
          firstName: merge.firstName,
          lastName: merge.lastName,
          title: merge.title,
          companyName: merge.companyName,
        },
        instructions: dto.instructions,
      },
      user.id,
    );
  }
}
