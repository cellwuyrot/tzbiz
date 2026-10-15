import { prisma } from "./db";

export const DEFAULT_SITE_SETTINGS = {
  id: "site-settings",
  tagline: "Цифровые решения для бизнеса",
  heroTitle: "Разрабатываем и поддерживаем цифровые системы.",
  heroSubtitle:
    "IT-услуги, интеграции и автоматизация. Выберите направление и обсудите задачу с командой TRIOZ.",
  contacts: "info@trioz.ru",
};

export async function getSiteSettings() {
  return prisma.siteSettings.findUnique({
    where: { id: DEFAULT_SITE_SETTINGS.id },
  });
}

export async function getSiteSettingsOrDefaults() {
  const settings = await getSiteSettings();
  return settings ?? { ...DEFAULT_SITE_SETTINGS, updatedAt: new Date() };
}
