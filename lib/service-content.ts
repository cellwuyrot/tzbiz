import type { Service, ServiceMedia } from "@prisma/client";
import { prisma } from "./db";

export type ServiceView = Omit<Service, "includes" | "stages" | "createdAt" | "updatedAt"> & {
  includes: string[];
  stages: string[];
  media: ServiceMediaView[];
};

export type ServiceMediaView = Pick<ServiceMedia, "id" | "type" | "path" | "sortOrder">;

export function parseStringList(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function serializeStringList(value: string[]) {
  return JSON.stringify(value);
}

export function toServiceView(
  service: Service & { media?: ServiceMedia[] },
): ServiceView {
  return {
    id: service.id,
    slug: service.slug,
    title: service.title,
    shortDescription: service.shortDescription,
    fullDescription: service.fullDescription,
    includes: parseStringList(service.includes),
    stages: parseStringList(service.stages),
    sortOrder: service.sortOrder,
    isPublished: service.isPublished,
    media: [...(service.media ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ id, type, path, sortOrder }) => ({ id, type, path, sortOrder })),
  };
}

export async function getPublishedServices() {
  const services = await prisma.service.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  return services.map(toServiceView);
}

export async function getAllServices() {
  const services = await prisma.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  return services.map(toServiceView);
}

export function getServiceBySlug(services: ServiceView[], slug: string | undefined) {
  return slug ? services.find((service) => service.slug === slug) ?? null : null;
}
