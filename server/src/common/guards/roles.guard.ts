import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RoleName } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { RequestUser } from "../types/request-user.type";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;
    if (!user || !requiredRoles.includes(user.role.name)) {
      throw new ForbiddenException("Insufficient role permissions");
    }
    return true;
  }
}
