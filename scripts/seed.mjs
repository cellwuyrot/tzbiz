import "dotenv/config";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!email || !password) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for seeding.");
}
if (password.length < 10) {
  throw new Error("ADMIN_PASSWORD must be at least 10 characters long.");
}

const content = JSON.parse(fs.readFileSync(new URL("../prisma/seed-content.json", import.meta.url), "utf8"));
const services = content.services;
const settings = content.settings;

const prisma = new PrismaClient();

async function ensureService(service, sortOrder) {
  const existing = await prisma.service.findUnique({ where: { slug: service.slug }, select: { id: true } });
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
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", name: "TRIOZ Admin" },
    create: { email, passwordHash, role: "ADMIN", name: "TRIOZ Admin" },
  });

  const existingSettings = await prisma.siteSettings.findUnique({ where: { id: "site-settings" } });
  if (!existingSettings) {
    await prisma.siteSettings.create({
      data: { id: "site-settings", ...settings },
    });
  }

  let createdServices = 0;
  for (let index = 0; index < services.length; index += 1) {
    if (await ensureService(services[index], index + 1)) createdServices += 1;
  }

  console.log("Seed complete: administrator, site settings, " + createdServices + " new services.");
} finally {
  await prisma.$disconnect();
}
