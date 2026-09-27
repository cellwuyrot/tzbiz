import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    service: { findMany: vi.fn() },
    siteSettings: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { getPublishedServices } from "@/lib/service-content";
import { getSiteSettingsOrDefaults } from "@/lib/site-settings";

describe("database content", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads published services from the database", async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValueOnce([
      {
        id: "cm00000000000000000000001",
        slug: "crm-integration",
        title: "CRM Интеграция",
        shortDescription: "Интеграция CRM.",
        fullDescription: "Полное описание.",
        includes: JSON.stringify(["Аналитика"]),
        stages: JSON.stringify(["Этап 1"]),
        sortOrder: 1,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        media: [],
      },
    ] as never);

    const services = await getPublishedServices();
    expect(services).toHaveLength(1);
    expect(services[0].slug).toBe("crm-integration");
    expect(services[0].includes).toEqual(["Аналитика"]);
  });

  it("reads the tagline from the database", async () => {
    vi.mocked(prisma.siteSettings.findUnique).mockResolvedValueOnce({
      id: "site-settings",
      tagline: "Девиз из БД",
      heroTitle: "Заголовок",
      heroSubtitle: "Подзаголовок",
      contacts: "contacts",
      updatedAt: new Date(),
    });

    const settings = await getSiteSettingsOrDefaults();
    expect(settings.tagline).toBe("Девиз из БД");
  });
});
