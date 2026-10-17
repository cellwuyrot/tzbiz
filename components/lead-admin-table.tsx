"use client";
import { renameDisplayText } from "@/lib/display-labels";

import { adminFetch } from "@/lib/admin-fetch";
import { useCallback, useEffect, useState } from "react";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/lead-status";
import {
  effectiveMailStatus,
  MAIL_ERROR_LABELS,
  MAIL_STATUS_LABELS,
  MAIL_RETRY_DELAY_MS,
  type MailChannel,
  type MailStatus,
} from "@/lib/mail-status";
import { TrashIcon } from "./icons";

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  serviceTitle: string;
  service: { slug: string; title: string } | null;
  message: string;
  status: (typeof LEAD_STATUSES)[number];
  clientEmailStatus?: MailStatus;
  internalEmailStatus?: MailStatus;
  clientEmailAttempts?: number;
  internalEmailAttempts?: number;
  clientEmailAttemptedAt?: string | null;
  internalEmailAttemptedAt?: string | null;
  clientEmailErrorCategory?: string | null;
  internalEmailErrorCategory?: string | null;
  createdAt: string;
  updatedAt: string;
};

async function csrfToken() {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("Не удалось получить CSRF-токен.");
  const data = await response.json();
  return String(data.token ?? "");
}

export function LeadAdminTable({
  initialLeads,
  onError,
  onChange,
}: {
  initialLeads: Lead[];
  onError: (message: string) => void;
  onChange?: (leads: Lead[]) => void;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [page, setPage] = useState(1),
    [total, setTotal] = useState(initialLeads.length),
    [query, setQuery] = useState(""),
    [q, setQ] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setRefreshing(true);
      try {
        const d = await adminFetch<{ leads: Lead[]; total: number }>(
          `/api/admin/leads?page=${page}&q=${encodeURIComponent(q)}`,
          { signal },
        );
        if (!signal?.aborted) {
          setLeads(d.leads);
          setTotal(d.total);
        }
      } catch (e) {
        if (!signal?.aborted)
          onError(e instanceof Error ? e.message : "Ошибка загрузки заявок.");
      } finally {
        if (!signal?.aborted) setRefreshing(false);
      }
    },
    [page, q, onError],
  );
  useEffect(() => {
    const c = new AbortController();
    void refresh(c.signal);
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh(c.signal);
    }, 60000);
    return () => {
      c.abort();
      window.clearInterval(timer);
    };
  }, [refresh]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    onChange?.(leads);
  }, [leads, onChange]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  async function updateStatus(id: string, status: Lead["status"]) {
    setLoadingId(id);
    onError("");
    try {
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": await csrfToken(),
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Не удалось обновить заявку.");
      }
      const data = await response.json();
      setLeads((prev) => {
        const next = prev.map((lead) => (lead.id === id ? data.lead : lead));
        return next;
      });
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Не удалось обновить заявку.",
      );
    } finally {
      setLoadingId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Удалить заявку?")) return;
    setLoadingId(id);
    onError("");
    try {
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": await csrfToken() },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Не удалось удалить заявку.");
      }
      setLeads((prev) => {
        const next = prev.filter((lead) => lead.id !== id);
        return next;
      });
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Не удалось удалить заявку.",
      );
    } finally {
      setLoadingId(null);
    }
  }

  async function retry(id: string, channel: MailChannel) {
    if (
      !window.confirm(
        "Повтор отправит письмо выбранного канала. При неизвестном результате или отсутствии истории возможно дублирование. Продолжить?",
      )
    )
      return;
    setLoadingId(id);
    onError("");
    try {
      const response = await fetch(
        `/api/admin/leads/${id}/notifications/retry`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": await csrfToken(),
          },
          body: JSON.stringify({ channel, confirmDuplicateRisk: true }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Повтор не выполнен.");
      if (data.lead)
        setLeads((prev) => {
          const next = prev.map((lead) => (lead.id === id ? data.lead : lead));
          return next;
        });
      if (!data.recorded)
        onError(
          "Результат не сохранён. Сначала проверьте ящики, чтобы избежать дублирования.",
        );
      else if (!data.ok)
        onError(
          "SMTP не подтвердил приём. Смотрите состояние выбранного канала.",
        );
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Повтор не выполнен.");
    } finally {
      setLoadingId(null);
    }
  }

  function mailCell(lead: Lead, channel: MailChannel) {
    const rawStatus =
      channel === "client" ? lead.clientEmailStatus : lead.internalEmailStatus;
    const attempted =
      channel === "client"
        ? lead.clientEmailAttemptedAt
        : lead.internalEmailAttemptedAt;
    const attempts =
      channel === "client"
        ? lead.clientEmailAttempts
        : lead.internalEmailAttempts;
    const category =
      channel === "client"
        ? lead.clientEmailErrorCategory
        : lead.internalEmailErrorCategory;
    const status = effectiveMailStatus(
      rawStatus ?? "UNTRACKED",
      attempted,
      now,
    );
    const coolingDown = Boolean(
      attempted && new Date(attempted).getTime() > now - MAIL_RETRY_DELAY_MS,
    );
    return (
      <div className="min-w-52 space-y-2 type-ui">
        <p className="font-semibold text-text">
          {channel === "client" ? "Клиент" : "Команда"}:{" "}
          {MAIL_STATUS_LABELS[status]}
        </p>
        <p className="text-subtle">
          Попыток: {attempts ?? 0}
          {attempted ? ` · ${new Date(attempted).toLocaleString("ru-RU")}` : ""}
        </p>
        {category ? (
          <p className="text-muted">
            {MAIL_ERROR_LABELS[category] || "Ошибка"}
          </p>
        ) : null}
        <button
          type="button"
          className="button-secondary"
          disabled={
            loadingId !== null ||
            status === "SMTP_ACCEPTED" ||
            status === "PENDING" ||
            coolingDown
          }
          onClick={() => retry(lead.id, channel)}
        >
          Повторить: {channel === "client" ? "клиент" : "команда"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(query);
        }}
      >
        <input
          className="field"
          aria-label="Поиск заявок"
          placeholder="Имя, email или компания"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="button-secondary">
          Найти
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          Обновить
        </button>
        <span className="type-ui text-muted" role="status">
          {refreshing ? "Обновление…" : `Заявок: ${total}`}
        </span>
      </form>
      {!leads.length && !refreshing ? (
        <p className="panel p-5 type-body text-muted">Заявки не найдены.</p>
      ) : null}
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        {leads.map((lead) => (
          <article key={lead.id} className="panel admin-card space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="type-h3 break-words">{lead.name}</h3>
                {lead.company ? (
                  <p className="type-ui text-muted">{lead.company}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="icon-button text-danger shrink-0"
                disabled={loadingId !== null}
                onClick={() => remove(lead.id)}
                aria-label={`Удалить заявку ${lead.name}`}
              >
                <TrashIcon />
              </button>
            </div>
            <dl className="admin-facts type-ui">
              <div>
                <dt>Email</dt>
                <dd>
                  <a
                    className="hover:text-accent"
                    href={`mailto:${lead.email}`}
                  >
                    {lead.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Телефон</dt>
                <dd>
                  <a
                    className="hover:text-accent"
                    href={`tel:${lead.phone.replace(/\s+/g, "")}`}
                  >
                    {lead.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Услуга</dt>
                <dd>
                  {renameDisplayText(lead.service?.title ?? lead.serviceTitle)}
                </dd>
              </div>
              <div>
                <dt>Дата обращения</dt>
                <dd>{new Date(lead.createdAt).toLocaleString("ru-RU")}</dd>
              </div>
            </dl>
            <label className="block type-ui">
              Статус
              <select
                className="field mt-2"
                value={lead.status}
                disabled={loadingId !== null}
                onChange={(event) =>
                  updateStatus(lead.id, event.target.value as Lead["status"])
                }
              >
                {LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {LEAD_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <details>
              <summary className="type-ui text-accent cursor-pointer">
                Комментарий
              </summary>
              <p className="mt-3 type-body text-muted whitespace-pre-wrap">
                {lead.message}
              </p>
            </details>
            <details>
              <summary className="type-ui text-accent cursor-pointer">
                Почтовые уведомления
              </summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {mailCell(lead, "client")}
                {mailCell(lead, "internal")}
              </div>
            </details>
          </article>
        ))}
      </div>
      <div className="admin-toolbar">
        <button
          className="button-secondary"
          disabled={page === 1 || refreshing}
          onClick={() => setPage(page - 1)}
        >
          Назад
        </button>
        <span className="type-ui">
          Страница {page} из {Math.max(1, Math.ceil(total / 20))}
        </span>
        <button
          className="button-secondary"
          disabled={page * 20 >= total || refreshing}
          onClick={() => setPage(page + 1)}
        >
          Далее
        </button>
      </div>
    </div>
  );
}
