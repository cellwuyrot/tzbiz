import type { Role } from "@prisma/client";

export function canAccessRole(actualRole: Role, requiredRole: Role) {
  return actualRole === requiredRole;
}

export function canAccessClientProject(userId: string, projectClientId: string | null) {
  return projectClientId === userId;
}
