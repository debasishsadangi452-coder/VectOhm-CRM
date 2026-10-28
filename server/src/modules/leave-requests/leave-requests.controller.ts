import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { LeaveStatus } from "@prisma/client";
import { LeaveRequestsService } from "./leave-requests.service";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { UpdateLeaveRequestDto } from "./dto/update-leave-request.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("leave-requests")
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("userId") userId?: string,
    @Query("status") status?: LeaveStatus,
  ) {
    return this.leaveRequestsService.findAll(user, { userId, status });
  }

  @Get("stats")
  getStats(@CurrentUser() user: RequestUser) {
    return this.leaveRequestsService.getStats(user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.leaveRequestsService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: RequestUser) {
    return this.leaveRequestsService.create(dto, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateLeaveRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.leaveRequestsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.leaveRequestsService.remove(id, user);
  }
}
