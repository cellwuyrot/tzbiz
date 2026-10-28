import "dotenv/config";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const content = JSON.parse(
  fs.readFileSync(
    new URL("../prisma/seed-content.json", import.meta.url),
    "utf8",
  ),
);
const services = content.services;
const settings = content.settings;

const prisma = new PrismaClient();

async function ensureService(service, sortOrder) {
  const existing = await prisma.service.findUnique({
    where: { slug: service.slug },
    select: { id: true },
  });
  if (existing) return false;
  await prisma.service.create({
    data: {
      slug: service.slug,
      title: service.title,
      shortDescription: service.shortDescription,
      fullDescription: service.fullDescription,
      includes: JSON.stringify(service.includes),
      stages: JSON.stringify(service.stages),
      sortOrder,
      isPublished: true,
    },
  });
  return true;
}

try {
  const existingSettings = await prisma.siteSettings.findUnique({
    where: { id: "site-settings" },
  });
  if (!existingSettings) {
    await prisma.siteSettings.create({
      data: { id: "site-settings", ...settings },
    });
  }

  let createdServices = 0;
  for (let index = 0; index < services.length; index += 1) {
    if (await ensureService(services[index], index + 1)) createdServices += 1;
  }

  console.log(
    "Seed complete: site settings, " +
      createdServices +
      " new services.",
  );
} finally {
  await prisma.$disconnect();
}
