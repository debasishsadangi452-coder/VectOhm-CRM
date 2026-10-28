import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { HiringSignalAutomationService } from "./hiring-signal-automation.service";
import { HiringSignalsDiscoveryService } from "./hiring-signals-discovery.service";
import { CreateHiringSignalAutomationDto } from "./dto/create-hiring-signal-automation.dto";
import { UpdateHiringSignalAutomationDto } from "./dto/update-hiring-signal-automation.dto";
import { IntentHiringSearchDto } from "./dto/intent-hiring-search.dto";
import { IntentNewsSearchDto } from "./dto/intent-news-search.dto";
import { EnrichIntentCompaniesDto } from "./dto/enrich-intent-companies.dto";
import { EnrollIntentContactsDto } from "./dto/enroll-intent-contacts.dto";
import { ResolveAndSendLeadDto } from "./dto/resolve-and-send-lead.dto";
import { AutomateIntentEmailDto } from "./dto/automate-intent-email.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("hiring-signal-automations")
export class HiringSignalAutomationController {
  constructor(
    private readonly automations: HiringSignalAutomationService,
    private readonly discovery: HiringSignalsDiscoveryService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.automations.findAll(user);
  }

  // Real-time live Intent Hiring search
  @Post("intent-search")
  searchIntent(@Body() dto: IntentHiringSearchDto, @CurrentUser() user: RequestUser) {
    return this.discovery.searchIntentHiring(dto, user);
  }

  // Intent News: companies with fresh Apollo news -> decision makers
  @Post("intent-news")
  searchIntentNews(@Body() dto: IntentNewsSearchDto, @CurrentUser() user: RequestUser) {
    return this.discovery.searchIntentNews(dto, user);
  }

  // Automated Email Outreach for selected Intent Hiring leads with custom/template variables
  @Post("automate-email")
  automateIntentEmail(@Body() dto: AutomateIntentEmailDto, @CurrentUser() user: RequestUser) {
    return this.discovery.automateIntentEmail(dto, user);
  }

  // Get most recent persisted Intent Hiring search for instant UI rendering
  @Get("intent-search/latest")
  getLatestIntentSearch(@CurrentUser() user: RequestUser) {
    return this.discovery.getLatestIntentSearch(user);
  }

  // Batch Apollo Decision-Maker (Founder & HR) enrichment & auto-enrollment
  @Post("intent-enrich")
  enrichIntentCompanies(@Body() dto: EnrichIntentCompaniesDto, @CurrentUser() user: RequestUser) {
    return this.discovery.enrichCompaniesWithApollo(dto, user);
  }

  // Get all saved enriched decision makers
  @Get("enriched-contacts")
  getEnrichedContacts(@CurrentUser() user: RequestUser) {
    return this.discovery.getEnrichedContacts(user);
  }

  // Enroll selected enriched decision makers into an email automation sequence
  @Post("enriched-contacts/enroll")
  enrollEnrichedContacts(@Body() dto: EnrollIntentContactsDto, @CurrentUser() user: RequestUser) {
    return this.discovery.enrollEnrichedContacts(dto, user);
  }

  // Delete an enriched decision maker record
  @Delete("enriched-contacts/:id")
  deleteEnrichedContact(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.discovery.deleteEnrichedContact(id, user);
  }

  // Per-lead "Find contact & send" -- for an Intent Hiring result the live
  // search didn't already resolve a decision-maker for.
  @Post("resolve-and-send")
  resolveAndSend(@Body() dto: ResolveAndSendLeadDto, @CurrentUser() user: RequestUser) {
    return this.discovery.resolveAndSend(dto.companyName, dto.companyDomain, dto.sequenceId, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.automations.findOne(id, user);
  }

  @Get(":id/signals")
  recentSignals(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.automations.recentSignals(id, user);
  }

  @Post()
  create(@Body() dto: CreateHiringSignalAutomationDto, @CurrentUser() user: RequestUser) {
    return this.automations.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateHiringSignalAutomationDto, @CurrentUser() user: RequestUser) {
    return this.automations.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.automations.remove(id, user);
  }

  // Manual trigger -- doesn't wait up to the cron interval, same pattern as
  // SequenceEngineService.runOnce() being both @Cron'd and directly callable.
  @Post(":id/run")
  runNow(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.discovery.runAutomation(id, user);
  }
}

