import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateGithubUsernameDto } from "./dto/update-github-username.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Open to any authenticated user so assignee/owner pickers can list people.
  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query("departmentId") departmentId?: string,
  ) {
    return this.usersService.findAll(departmentId, user);
  }

  @Public()
  @Get("avatar/:filename")
  streamAvatar(
    @Param("filename") filename: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.usersService.streamAvatar(filename, res);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.usersService.findOne(id, user);
  }

  // Self-service: any authenticated user edits their OWN profile (name, email,
  // avatar, password). Declared before the ":id" PATCH so "me" isn't parsed as
  // an id. The user id comes from the token, never the body.
  @Patch("me")
  updateOwnProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: RequestUser) {
    return this.usersService.updateOwnProfile(user.id, dto);
  }

  @Post("me/avatar")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(png|jpeg|jpg|webp|gif)$/i)) {
          return cb(new BadRequestException("Only image files are allowed"), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.uploadAvatar(user.id, file);
  }

  // Admin OR HR (see canManageDirectory) -- enforced in the service, not via
  // @Roles, since it's not a plain single-role gate.
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: RequestUser) {
    return this.usersService.create(dto, actor);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: RequestUser) {
    return this.usersService.update(id, dto, actor);
  }

  @Patch(":id/target")
  updateTarget(
    @Param("id") id: string,
    @Body("monthlyTarget") monthlyTarget: number | null,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.updateTarget(id, monthlyTarget, user);
  }

  // Self-service: this only ever touches the caller's own githubUsername (or,
  // for Admin, anyone's), so every developer can self-link their GitHub
  // account -- no directory-management authority required.
  @Patch(":id/github-username")
  updateGithubUsername(
    @Param("id") id: string,
    @Body() dto: UpdateGithubUsernameDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.updateGithubUsername(id, dto.githubUsername ?? null, user);
  }

  // Soft delete: deactivates rather than removing the row (preserves task/project history).
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() actor: RequestUser) {
    return this.usersService.deactivate(id, actor);
  }

  // Permanent, irreversible erasure -- see UsersService.permanentlyDelete for
  // exactly what is and isn't removed with the account.
  @Delete(":id/permanent")
  removePermanently(@Param("id") id: string, @CurrentUser() actor: RequestUser) {
    return this.usersService.permanentlyDelete(id, actor);
  }
}
