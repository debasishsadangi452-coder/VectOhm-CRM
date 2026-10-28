import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";
import { AttendancePolicyService } from "./attendance-policy.service";
import { ShiftTemplatesService } from "./shift-templates.service";
import { UpdateAttendanceSettingsDto, UpdateDeptPolicyDto } from "./dto/attendance-settings.dto";
import { ApplyShiftTemplateDto, CreateShiftTemplateDto, UpdateShiftTemplateDto } from "./dto/shift-template.dto";

/** Admin/HR: the attendance rules, per-department overrides, and shift templates. */
@Controller("attendance-settings")
export class AttendanceSettingsController {
  constructor(
    private readonly policy: AttendancePolicyService,
    private readonly templates: ShiftTemplatesService,
  ) {}

  /** GET /attendance-settings — current rules, defaults, limits, departments and overrides */
  @Get()
  get(@CurrentUser() user: RequestUser) {
    return this.policy.getSettingsView(user);
  }

  /** PUT /attendance-settings — change the company-wide rules */
  @Put()
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateAttendanceSettingsDto) {
    return this.policy.updateGlobal(user, dto);
  }

  /** GET /attendance-settings/active-gap — seconds of OS idle below which a ping counts as active */
  @Get("active-gap")
  async getActiveGap() {
    return { activeGapSec: await this.policy.getActiveGapSec() };
  }

  /** PUT /attendance-settings/departments/:id — set a department's overrides (null clears a field) */
  @Put("departments/:departmentId")
  setDepartment(
    @CurrentUser() user: RequestUser,
    @Param("departmentId") departmentId: string,
    @Body() dto: UpdateDeptPolicyDto,
  ) {
    return this.policy.setDepartmentOverride(user, departmentId, dto);
  }

  /** DELETE /attendance-settings/departments/:id — drop a department back to the company rules */
  @Delete("departments/:departmentId")
  clearDepartment(@CurrentUser() user: RequestUser, @Param("departmentId") departmentId: string) {
    return this.policy.clearDepartmentOverride(user, departmentId);
  }

  // ─── shift templates ────────────────────────────────────────────────────────

  @Get("shift-templates")
  listTemplates(@CurrentUser() user: RequestUser) {
    return this.templates.list(user);
  }

  @Post("shift-templates")
  createTemplate(@CurrentUser() user: RequestUser, @Body() dto: CreateShiftTemplateDto) {
    return this.templates.create(user, dto);
  }

  @Put("shift-templates/:id")
  updateTemplate(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateShiftTemplateDto) {
    return this.templates.update(user, id, dto);
  }

  @Delete("shift-templates/:id")
  removeTemplate(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.templates.remove(user, id);
  }

  /** POST /attendance-settings/shift-templates/:id/apply — copy a template's hours onto chosen people */
  @Post("shift-templates/:id/apply")
  applyTemplate(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: ApplyShiftTemplateDto) {
    return this.templates.apply(user, id, dto.userIds);
  }
}
