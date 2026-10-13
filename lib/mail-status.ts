export const MAIL_CHANNELS = ["client", "internal"] as const;
export type MailChannel = (typeof MAIL_CHANNELS)[number];
export const MAIL_STATUSES = ["UNTRACKED", "PENDING", "SMTP_ACCEPTED", "FAILED", "UNKNOWN"] as const;
export type MailStatus = (typeof MAIL_STATUSES)[number];
export const MAIL_LEASE_MS = 2 * 60 * 1000;
export const MAIL_RETRY_DELAY_MS = 60 * 1000;
export const MAIL_STATUS_LABELS: Record<MailStatus, string> = {
  UNTRACKED: "Нет истории отправки", PENDING: "Попытка отправки", SMTP_ACCEPTED: "Принято SMTP",
  FAILED: "Не принято SMTP", UNKNOWN: "Результат неизвестен",
};
export const MAIL_ERROR_LABELS: Record<string, string> = {
  CONFIG: "Проверьте конфигурацию", AUTH: "Ошибка авторизации", TLS: "Ошибка TLS",
  CONNECTION: "Нет соединения", TIMEOUT: "Таймаут: возможна доставка", RECIPIENT: "Получатель отклонён",
  SMTP: "Отказ SMTP", UNKNOWN: "Неизвестный результат",
};
export type MailResult = { status: "SMTP_ACCEPTED" | "FAILED" | "UNKNOWN"; errorCategory: string | null };
export function effectiveMailStatus(status: MailStatus, attemptedAt: string | Date | null | undefined, now = Date.now()): MailStatus {
  if (status === "PENDING" && (!attemptedAt || new Date(attemptedAt).getTime() <= now - MAIL_LEASE_MS)) return "UNKNOWN";
  return status;
}
