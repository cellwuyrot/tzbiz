import { prisma } from "./db";

export const DEFAULT_SITE_SETTINGS = {
  id: "site-settings",
  tagline: "",
  heroTitle: "",
  heroSubtitle: "",
  contacts: "",
};

export async function getSiteSettings() {
  return prisma.siteSettings.findUnique({ where: { id: DEFAULT_SITE_SETTINGS.id } });
}

export async function getSiteSettingsOrDefaults() {
  const settings = await getSiteSettings();
  return settings ?? { ...DEFAULT_SITE_SETTINGS, updatedAt: new Date() };
}
