import { SetMetadata } from "@nestjs/common";

export const DEPARTMENT_KEY = "department";

export type DepartmentName = "Dev" | "Development" | "Sales" | "Recruitment" | "HR" | "Digital Marketing" | "Executive" | (string & {});

/**
 * Declares that a controller or endpoint requires membership in the specified department(s).
 * Admin role is always exempt and possesses global access.
 */
export const Department = (...departments: DepartmentName[]) =>
  SetMetadata(DEPARTMENT_KEY, departments);
