import type { Project, User } from "@prisma/client";
import { prisma } from "./db";
import { canAccessClientProject } from "./access-policy";

export async function getVisibleProjectForUser(projectId: string, user: Pick<User, "id" | "role">) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  if (user.role === "ADMIN") return project;
  if (user.role === "CLIENT" && canAccessClientProject(user.id, project.clientId)) return project;
  return null;
}

export async function getClientProjects(clientId: string): Promise<Project[]> {
  return prisma.project.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });
}
