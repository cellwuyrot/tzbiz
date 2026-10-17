"use client";
import { adminFetch } from "@/lib/admin-fetch";
import { useCallback, useEffect, useState } from "react";
import type { IntegrationStatus } from "@/lib/integration-status";
import {
  MAIL_ERROR_LABELS,
  MAIL_STATUS_LABELS,
  type MailResult,
} from "@/lib/mail-status";

export function AdminIntegrations() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStatus(await adminFetch<IntegrationStatus>("/api/admin/integrations"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh().catch((cause) =>
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось загрузить интеграции.",
      ),
    );
  }, [refresh]);

  function describe(result: MailResult) {
    return (
      MAIL_STATUS_LABELS[result.status] +
      (result.errorCategory
        ? ` — ${MAIL_ERROR_LABELS[result.errorCategory] || "Ошибка"}`
        : "")
    );
  }
  async function action(kind: "verify" | "test") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const csrf = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
      });
      if (!csrf.ok) throw new Error("Не удалось получить CSRF-токен.");
      const { token } = await csrf.json();
      const response = await fetch(`/api/admin/integrations/email/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify(
          kind === "test" ? { email, confirmSend: confirmed } : {},
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Проверка не выполнена.");
      setNotice(
        kind === "verify"
          ? data.ok
            ? "SMTP-соединение и авторизация проверены. Право отправителя и доставка ещё не подтверждены."
            : `Проверка соединения: ${data.result.errorCategory === "TIMEOUT" ? "истекло время ожидания; письма не отправлялись" : MAIL_ERROR_LABELS[data.result.errorCategory] || "неизвестная ошибка"}`
          : `Клиентский тест: ${describe(data.results.client)}. Внутренний тест: ${describe(data.results.internal)}. Принятие SMTP не доказывает доставку в ящик.`,
      );
      if (!data.recorded)
        setError(
          "Результат проверки не сохранён в БД. Не повторяйте отправку без проверки ящиков.",
        );
      if (kind === "test") setConfirmed(false);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Проверка не выполнена.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-10 space-y-6" aria-labelledby="integrations-title">
      <h2 id="integrations-title" className="type-h2">
        Интеграции
      </h2>

      {error ? (
        <p className="panel p-4 text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="panel p-4 text-muted" role="status">
          {notice}
        </p>
      ) : null}
      <button
        type="button"
        className="button-secondary"
        disabled={loading || busy}
        onClick={() =>
          refresh().catch((cause) =>
            setError(
              cause instanceof Error ? cause.message : "Ошибка загрузки.",
            ),
          )
        }
      >
        {loading ? "Загрузка…" : "Обновить состояние"}
      </button>
      {loading && !status ? (
        <p role="status" className="type-body text-muted">
          Загрузка состояния…
        </p>
      ) : null}
      {status ? (
        <>
          {status.checksError ? (
            <p className="panel p-4 text-danger" role="alert">
              История проверок недоступна. {status.checksError.message} Код
              обращения: {status.checksError.requestId}
            </p>
          ) : null}
          <div className="panel space-y-4 p-6">
            <h3 className="type-h3">Очередь уведомлений</h3>
            <dl className="admin-facts type-ui">
              <div>
                <dt>Планировщик</dt>
                <dd>
                  {status.worker?.healthy
                    ? "Работает"
                    : "Нет успешного запуска за последние 5 минут"}
                </dd>
              </div>
              <div>
                <dt>Последний успешный запуск</dt>
                <dd>
                  {status.worker?.lastSuccessAt
                    ? new Date(status.worker.lastSuccessAt).toLocaleString(
                        "ru-RU",
                      )
                    : "Не зафиксирован"}
                </dd>
              </div>
              <div>
                <dt>В очереди</dt>
                <dd>{status.worker?.pendingMailJobs ?? "Недоступно"}</dd>
              </div>
              <div>
                <dt>Исчерпаны попытки</dt>
                <dd>{status.worker?.failedMailJobs ?? "Недоступно"}</dd>
              </div>
            </dl>
          </div>
          <div className="panel space-y-4 p-6">
            <h3 className="type-h3">Почта / SMTP</h3>
            <p className="type-body text-muted">
              {status.mail.configured ? "Конфигурация задана" : "Не настроена"}
            </p>
            <dl className="grid gap-3 type-ui sm:grid-cols-2">
              <div>
                <dt className="text-subtle">SMTP host / логин / пароль</dt>
                <dd>
                  {status.mail.hostConfigured ? "Host задан" : "Нет host"} ·{" "}
                  {status.mail.userConfigured ? "Логин задан" : "Нет логина"} ·{" "}
                  {status.mail.passwordConfigured
                    ? "Секрет задан"
                    : "Нет секрета"}
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Соединение</dt>
                <dd>
                  Порт {status.mail.port ?? "неверный"} ·{" "}
                  {status.mail.tlsMode ?? "неверный TLS режим"}
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Отправитель EMAIL_FROM</dt>
                <dd className="break-all">
                  {status.mail.from ?? "Неверный адрес"}
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Команда LEADS_EMAIL_TO</dt>
                <dd className="break-all">
                  {status.mail.internalTo ?? "Неверный адрес"}
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Ответ клиента EMAIL_REPLY_TO</dt>
                <dd className="break-all">
                  {status.mail.replyTo ?? "Неверный адрес"}
                </dd>
              </div>
            </dl>
            {status.mail.missingKeys.length ? (
              <p className="type-ui text-danger">
                Не заданы: {status.mail.missingKeys.join(", ")}
              </p>
            ) : null}
            {status.mail.invalidKeys.length ? (
              <p className="type-ui text-danger">
                Проверить: {status.mail.invalidKeys.join(", ")}
              </p>
            ) : null}

            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() => action("verify")}
            >
              Проверить SMTP без отправки письма
            </button>
            <form
              className="space-y-4 border-t border-border pt-5"
              onSubmit={(event) => {
                event.preventDefault();
                action("test");
              }}
            >
              <label className="block type-ui" htmlFor="smtp-test-email">
                Согласованный тестовый email клиента
              </label>
              <input
                id="smtp-test-email"
                className="field max-w-xl"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <label className="flex gap-3 type-ui text-muted">
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  Подтверждаю отправку двух диагностических писем: на указанный
                  адрес и {status.mail.internalTo ?? "внутренний адрес"}. Это не
                  создаёт заявку.
                </span>
              </label>
              <button
                type="submit"
                className="button-primary"
                disabled={busy || !confirmed || !status.mail.configured}
              >
                Отправить два тестовых письма
              </button>
            </form>
            <div className="space-y-2 type-ui text-muted">
              {status.checks.length ? (
                status.checks.map((check) => (
                  <p key={check.key}>
                    {check.key === "smtp.verify"
                      ? "Проверка соединения"
                      : "Тест двух каналов"}
                    :{" "}
                    {(
                      {
                        SUCCESS: "Успешно",
                        FAILED: "Ошибка",
                        PARTIAL: "Частично выполнено",
                      } as Record<string, string>
                    )[check.status] || check.status}{" "}
                    · {new Date(check.checkedAt).toLocaleString("ru-RU")}
                    {check.errorCategory ? ` · ${check.errorCategory}` : ""}
                  </p>
                ))
              ) : (
                <p>Проверки ещё не выполнялись.</p>
              )}
            </div>
          </div>
          <div className="panel space-y-4 p-6">
            <h3 className="type-h3">TZ ID</h3>
            <p className="type-body text-muted">
              {status.tzId?.configured ? "Конфигурация задана" : "Не настроен"}
            </p>
            <p className="type-ui text-muted break-all">
              Issuer: {status.tzId?.issuer} · Callback:{" "}
              {status.tzId?.callbackUrl}
            </p>
            {status.tzId?.missingKeys.length ? (
              <p className="type-ui text-danger">
                Не заданы: {status.tzId.missingKeys.join(", ")}
              </p>
            ) : null}
            {status.tzId?.invalidKeys.length ? (
              <p className="type-ui text-danger">
                Проверить: {status.tzId.invalidKeys.join(", ")}
              </p>
            ) : null}

            <dl className="admin-facts type-ui">
              <div>
                <dt>Выдача прав в проекты TrioZ</dt>
                <dd>Не подключена</dd>
              </div>
              <div>
                <dt>Локальные автоматические списания</dt>
                <dd>Не подключены</dd>
              </div>
            </dl>

            <a
              className="button-secondary"
              href="https://trioz.ru/connect"
              target="_blank"
              rel="noopener noreferrer"
            >
              Открыть основную платформу
            </a>
          </div>
        </>
      ) : null}
    </section>
  );
}
