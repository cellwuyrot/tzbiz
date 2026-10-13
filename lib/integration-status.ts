import { prisma } from "./db";
import { mailConfigSnapshot } from "./mailer-config";
export async function integrationStatus() {
  const checks = await prisma.integrationCheck.findMany({ where: { key: { in: ["smtp.verify", "smtp.test"] } } });
  return {
    mail: mailConfigSnapshot(),
    checks: checks.map(check => ({ key: check.key, status: check.status, checkedAt: check.checkedAt.toISOString(), errorCategory: check.errorCategory })),
    platform: { connected: false as const, reason: "API основной платформы не согласован и не подключён. Письмо на info@trioz.ru не создаёт клиента или подписку в trioz.ru." },
  };
}
export type IntegrationStatus = Awaited<ReturnType<typeof integrationStatus>>;
export async function recordIntegrationCheck(key: "smtp.verify" | "smtp.test", status: string, errorCategory: string | null) {
  const checkedAt = new Date();
  try {
    await prisma.integrationCheck.upsert({ where: { key }, create: { key, status, errorCategory, checkedAt }, update: { status, errorCategory, checkedAt } });
    return true;
  } catch { console.error("Integration check result not recorded"); return false; }
}
