import { logFailure } from "./diagnostics";
import { prisma } from "./db";
import { tzIdConfigSnapshot } from "./tz-id/config";
import { mailConfigSnapshot } from "./mailer-config";
export async function integrationStatus() {
  let checksError: ReturnType<typeof logFailure> | null = null;
  const checks = await prisma.integrationCheck
    .findMany({
      where: { key: { in: ["smtp.verify", "smtp.test"] } },
    })
    .catch((error: unknown) => {
      checksError = logFailure("integrations.history", error);
      return [];
    });
  const worker = await prisma.maintenanceState
    .findUnique({ where: { key: "mail-worker" } })
    .catch(() => null);
  const pendingMailJobs = await prisma.mailJob
    .count({ where: { status: { in: ["PENDING", "RUNNING"] } } })
    .catch(() => null);
  const failedMailJobs = await prisma.mailJob
    .count({ where: { status: "FAILED" } })
    .catch(() => null);
  return {
    worker: {
      lastSuccessAt: worker?.lastSuccessAt.toISOString() || null,
      healthy: Boolean(
        worker && Date.now() - worker.lastSuccessAt.getTime() < 300000,
      ),
      pendingMailJobs,
      failedMailJobs,
    },
    checksError: checksError as ReturnType<typeof logFailure> | null,
    mail: mailConfigSnapshot(),
    tzId: tzIdConfigSnapshot(),
    billing: {
      checkoutEnabled: false as const,
      recurringEnabled: false as const,
      provider: "Провайдер оплаты (не подключён)",
      premiumVpnFulfillment: false as const,
    },
    checks: checks.map((check) => ({
      key: check.key,
      status: check.status,
      checkedAt: check.checkedAt.toISOString(),
      errorCategory: check.errorCategory,
    })),
    platform: {
      connected: false as const,
      reason:
        "Вход Business через существующий OIDC TZ ID реализован и требует конфигурации. Заявки на тарифы и снимки условий реализованы. Обмен подписками, приём платежей и выдача Premium / «Надёжное соединение» требуют контракта центрального биллинга. Письмо на info@trioz.ru не создаёт аккаунт или подписку.",
    },
  };
}
export type IntegrationStatus = Awaited<ReturnType<typeof integrationStatus>>;
export async function recordIntegrationCheck(
  key: "smtp.verify" | "smtp.test",
  status: string,
  errorCategory: string | null,
) {
  const checkedAt = new Date();
  try {
    await prisma.integrationCheck.upsert({
      where: { key },
      create: { key, status, errorCategory, checkedAt },
      update: { status, errorCategory, checkedAt },
    });
    return true;
  } catch {
    console.error("Integration check result not recorded");
    return false;
  }
}
