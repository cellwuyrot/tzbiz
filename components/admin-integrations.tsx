"use client";
import { useCallback, useEffect, useState } from "react";
import type { IntegrationStatus } from "@/lib/integration-status";
import { MAIL_ERROR_LABELS, MAIL_STATUS_LABELS, type MailResult } from "@/lib/mail-status";

export function AdminIntegrations() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/integrations", { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось загрузить состояние интеграций.");
    setStatus(await response.json());
  }, []);
  useEffect(() => { refresh().catch(() => setError("Не удалось загрузить состояние интеграций. Проверьте миграции и права доступа.")); }, [refresh]);

  function describe(result: MailResult) {
    return MAIL_STATUS_LABELS[result.status] + (result.errorCategory ? ` — ${MAIL_ERROR_LABELS[result.errorCategory] || "Ошибка"}` : "");
  }
  async function action(kind: "verify" | "test") {
    setBusy(true); setError(""); setNotice("");
    try {
      const csrf = await fetch("/api/auth/csrf", { credentials: "same-origin" });
      if (!csrf.ok) throw new Error("Не удалось получить CSRF-токен.");
      const { token } = await csrf.json();
      const response = await fetch(`/api/admin/integrations/email/${kind}`, {
        method: "POST", headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify(kind === "test" ? { email, confirmSend: confirmed } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Проверка не выполнена.");
      setNotice(kind === "verify"
        ? (data.ok ? "SMTP-соединение и авторизация проверены. Право отправителя и доставка ещё не подтверждены." : `Проверка соединения: ${data.result.errorCategory === "TIMEOUT" ? "истекло время ожидания; письма не отправлялись" : MAIL_ERROR_LABELS[data.result.errorCategory] || "неизвестная ошибка"}`)
        : `Клиентский тест: ${describe(data.results.client)}. Внутренний тест: ${describe(data.results.internal)}. Принятие SMTP не доказывает доставку в ящик.`);
      if (!data.recorded) setError("Результат проверки не сохранён в БД. Не повторяйте отправку без проверки ящиков.");
      if (kind === "test") setConfirmed(false);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Проверка не выполнена."); }
    finally { setBusy(false); }
  }
  return (
    <section className="mt-10 space-y-6" aria-labelledby="integrations-title">
      <h2 id="integrations-title" className="type-h2">Интеграции</h2>
      <p className="type-body text-muted">Здесь видна эффективная конфигурация работающего tzbiz. Секреты не возвращаются в браузер и меняются только на сервере.</p>
      {error ? <p className="panel p-4 text-danger" role="alert">{error}</p> : null}
      {notice ? <p className="panel p-4 text-muted" role="status">{notice}</p> : null}
      {!status ? <p className="type-body text-muted">Загрузка состояния…</p> : (
        <>
          <div className="panel space-y-4 p-6">
            <h3 className="type-h3">Почта / SMTP</h3>
            <p className="type-body text-muted">{status.mail.configured ? "Настройки заданы — это ещё не подтверждение доставки." : "Конфигурация требует настройки."}</p>
            <dl className="grid gap-3 type-ui sm:grid-cols-2">
              <div><dt className="text-subtle">SMTP host / логин / пароль</dt><dd>{status.mail.hostConfigured ? "Host задан" : "Нет host"} · {status.mail.userConfigured ? "Логин задан" : "Нет логина"} · {status.mail.passwordConfigured ? "Секрет задан" : "Нет секрета"}</dd></div>
              <div><dt className="text-subtle">Соединение</dt><dd>Порт {status.mail.port ?? "неверный"} · {status.mail.tlsMode ?? "неверный TLS режим"}</dd></div>
              <div><dt className="text-subtle">Отправитель EMAIL_FROM</dt><dd className="break-all">{status.mail.from ?? "Неверный адрес"}</dd></div>
              <div><dt className="text-subtle">Команда LEADS_EMAIL_TO</dt><dd className="break-all">{status.mail.internalTo ?? "Неверный адрес"}</dd></div>
              <div><dt className="text-subtle">Ответ клиента EMAIL_REPLY_TO</dt><dd className="break-all">{status.mail.replyTo ?? "Неверный адрес"}</dd></div>
            </dl>
            {status.mail.missingKeys.length ? <p className="type-ui text-danger">Не заданы: {status.mail.missingKeys.join(", ")}</p> : null}
            {status.mail.invalidKeys.length ? <p className="type-ui text-danger">Проверить: {status.mail.invalidKeys.join(", ")}</p> : null}
            <p className="type-ui text-subtle">SMTP_USER не обязан совпадать с отправителем. Провайдер должен разрешать EMAIL_FROM; SPF/DKIM/DMARC и реальная доставка проверяются отдельно. Переопределения PM2 могут отличаться от .env.</p>
            <button type="button" className="button-secondary" disabled={busy} onClick={() => action("verify")}>Проверить SMTP без отправки письма</button>
            <form className="space-y-4 border-t border-border pt-5" onSubmit={event => { event.preventDefault(); action("test"); }}>
              <label className="block type-ui" htmlFor="smtp-test-email">Согласованный тестовый email клиента</label>
              <input id="smtp-test-email" className="field max-w-xl" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
              <label className="flex gap-3 type-ui text-muted"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Подтверждаю отправку двух диагностических писем: на указанный адрес и {status.mail.internalTo ?? "внутренний адрес"}. Это не создаёт заявку.</span></label>
              <button type="submit" className="button-primary" disabled={busy || !confirmed || !status.mail.configured}>Отправить два тестовых письма</button>
            </form>
            <div className="space-y-2 type-ui text-muted">
              {status.checks.length ? status.checks.map(check => <p key={check.key}>{check.key === "smtp.verify" ? "Проверка соединения" : "Тест двух каналов"}: {check.status} · {new Date(check.checkedAt).toLocaleString("ru-RU")}{check.errorCategory ? ` · ${check.errorCategory}` : ""}</p>) : <p>Проверки ещё не выполнялись.</p>}
            </div>
          </div>
          <div className="panel space-y-4 p-6">
            <h3 className="type-h3">TZ ID и будущий биллинг</h3>
            <p className="type-body text-muted">{status.tzId?.configured ? "OIDC-конфигурация задана. Реальный вход проверяется отдельно." : "Вход через TZ ID требует настройки."}</p>
            <p className="type-ui text-muted break-all">Issuer: {status.tzId?.issuer} · Callback: {status.tzId?.callbackUrl}</p>
            {status.tzId?.missingKeys.length ? <p className="type-ui text-danger">Не заданы: {status.tzId.missingKeys.join(", ")}</p> : null}
            {status.tzId?.invalidKeys.length ? <p className="type-ui text-danger">Проверить: {status.tzId.invalidKeys.join(", ")}</p> : null}
            <p className="type-body text-muted">Т-Банк, автоматические списания и выдача Premium/VPN не подключены. Создание тарифов не создаёт платежей.</p>
            <p className="type-body text-muted">Обмен подписками не включён. {status.platform.reason}</p>
            <p className="type-ui text-subtle">OIDC client secret и ключ шифрования хранятся только в окружении Business. Центральный профиль не копируется. API выдачи Premium/VPN и постоянной фоновой синхронизации в найденном Hub отсутствует. Почтовая отправка не требует API основной платформы.</p>
            <a className="button-secondary" href="https://trioz.ru/connect" target="_blank" rel="noopener noreferrer">Открыть основную платформу</a>
          </div>
        </>
      )}
    </section>
  );
}
