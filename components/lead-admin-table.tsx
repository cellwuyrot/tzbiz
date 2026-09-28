"use client";

import { useState } from "react";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/lead-status";
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
  createdAt: string;
  updatedAt: string;
};

async function csrfToken() {
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  if (!response.ok) throw new Error("Не удалось получить CSRF-токен.");
  const data = await response.json();
  return String(data.token ?? "");
}

export function LeadAdminTable({ initialLeads, onError, onChange }: { initialLeads: Lead[]; onError: (message: string) => void; onChange?: (leads: Lead[]) => void }) {
  const [leads, setLeads] = useState(initialLeads);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function updateStatus(id: string, status: Lead["status"]) {
    setLoadingId(id);
    onError("");
    try {
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": await csrfToken() },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Не удалось обновить заявку.");
      }
      const data = await response.json();
      setLeads((prev) => { const next = prev.map((lead) => lead.id === id ? data.lead : lead); onChange?.(next); return next; });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось обновить заявку.");
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
      setLeads((prev) => { const next = prev.filter((lead) => lead.id !== id); onChange?.(next); return next; });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось удалить заявку.");
    } finally {
      setLoadingId(null);
    }
  }

  if (!leads.length) {
    return <div className="panel p-6 type-body text-muted">Заявок пока нет. Новые заявки появятся здесь после отправки формы на сайте.</div>;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-panel">
      <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full border-collapse text-left">
          <thead className="bg-panel-2">
            <tr>
              {['Дата', 'Клиент', 'Контакты', 'Услуга', 'Особенности / комментарии', 'Статус', ''].map((label) => (
                <th key={label} scope="col" className="border-b border-border px-5 py-4 type-ui font-semibold text-muted">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="align-top hover:bg-accent-soft/30">
                <td className="border-b border-border px-5 py-5 type-ui text-subtle whitespace-nowrap">
                  {new Date(lead.createdAt).toLocaleString("ru-RU")}
                </td>
                <td className="border-b border-border px-5 py-5">
                  <div className="type-body font-semibold text-text">{lead.name}</div>
                  <div className="mt-1 type-ui text-subtle">{lead.company || "Без компании"}</div>
                </td>
                <td className="border-b border-border px-5 py-5 type-ui text-muted">
                  <a href={`mailto:${lead.email}`} className="block hover:text-accent">{lead.email}</a>
                  <a href={`tel:${lead.phone.replace(/\s+/g, "")}`} className="mt-1 block hover:text-accent">{lead.phone}</a>
                </td>
                <td className="border-b border-border px-5 py-5 type-body text-text">{lead.service?.title ?? lead.serviceTitle}</td>
                <td className="border-b border-border px-5 py-5 min-w-[380px] type-body text-muted whitespace-pre-wrap">{lead.message}</td>
                <td className="border-b border-border px-5 py-5">
                  <select
                    className="field min-w-40"
                    value={lead.status}
                    disabled={loadingId === lead.id}
                    aria-label={`Статус заявки ${lead.name}`}
                    onChange={(event) => updateStatus(lead.id, event.target.value as Lead["status"])}
                  >
                    {LEAD_STATUSES.map((status) => <option key={status} value={status}>{LEAD_STATUS_LABELS[status]}</option>)}
                  </select>
                </td>
                <td className="border-b border-border px-5 py-5">
                  <button type="button" className="icon-button text-danger" disabled={loadingId === lead.id} onClick={() => remove(lead.id)} aria-label={`Удалить заявку ${lead.name}`}>
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
