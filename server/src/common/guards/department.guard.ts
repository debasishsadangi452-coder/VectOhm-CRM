import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DEPARTMENT_KEY } from '../decorators/department.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { hasDepartmentAccess } from '../utils/department-access';

@Injectable()
export class DepartmentGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredDepartments = this.reflector.getAllAndOverride<string[]>(DEPARTMENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no department is specified on the route/controller, allow access (other guards like RolesGuard still apply)
    if (!requiredDepartments || requiredDepartments.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User authentication required');
    }

    // ADMIN has unrestricted global access; everyone else needs a matching department.
    if (!hasDepartmentAccess(user, requiredDepartments)) {
      throw new ForbiddenException(
        `Access denied: This resource belongs to [${requiredDepartments.join(', ')}]. Your department is [${user.department?.name || 'None'}].`
      );
    }

    return true;
  }
}
