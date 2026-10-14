"use client";
import { useCallback, useEffect, useState } from "react";
import { PLAN_KIND_LABELS, PERIOD_LABELS, minorToRubles } from "@/lib/billing/plan";
type PlanForm = { kind: "SERVICE" | "PREMIUM" | "VPN"; serviceId: string; title: string; description: string; mode: "ONE_TIME" | "RECURRING"; amountRub: string; currency: "RUB"; periodUnit: "DAY" | "WEEK" | "MONTH" | "YEAR"; periodCount: number; renewalTerms: string; cancellationTerms: string; internalNotes: string; isPublished: boolean; isArchived: boolean };
type SavedPlan = Omit<PlanForm, "serviceId" | "periodUnit" | "periodCount" | "amountRub"> & { id: string; serviceId: string | null; periodUnit: PlanForm["periodUnit"] | null; periodCount: number | null; amountMinor: number | null; revision: number; updatedAt: string };
type Service = { id: string; title: string; isPublished: boolean };
const empty: PlanForm = { kind: "SERVICE", serviceId: "", title: "", description: "", mode: "ONE_TIME", amountRub: "", currency: "RUB", periodUnit: "MONTH", periodCount: 1, renewalTerms: "", cancellationTerms: "", internalNotes: "", isPublished: false, isArchived: false };
export function AdminBillingPlans() {
  const [plans, setPlans] = useState<SavedPlan[]>([]), [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState<PlanForm>(empty), [edit, setEdit] = useState<{ id: string; revision: number } | null>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/billing/plans", { cache: "no-store" });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Тарифы недоступны.");
    setPlans(data.plans); setServices(data.services);
  }, []);
  useEffect(() => { refresh().catch(() => setError("Не удалось загрузить тарифы. Проверьте миграцию 0006.")); }, [refresh]);
  function field<K extends keyof PlanForm>(key: K, value: PlanForm[K]) { setForm(previous => ({ ...previous, [key]: value })); }
  function select(plan: SavedPlan) {
    setForm({ ...plan, amountRub: minorToRubles(plan.amountMinor), serviceId: plan.serviceId || "", periodUnit: plan.periodUnit || "MONTH", periodCount: plan.periodCount || 1 });
    setEdit({ id: plan.id, revision: plan.revision }); setError(""); setNotice("");
    document.getElementById("billing-plan-form")?.scrollIntoView({ behavior: "smooth" });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const csrfResponse = await fetch("/api/auth/csrf"); if (!csrfResponse.ok) throw new Error("CSRF недоступен.");
      const { token } = await csrfResponse.json();
      const response = await fetch(edit ? `/api/admin/billing/plans/${edit.id}` : "/api/admin/billing/plans", {
        method: edit ? "PATCH" : "POST", headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ ...form, serviceId: form.kind === "SERVICE" ? form.serviceId || null : null, periodUnit: form.mode === "RECURRING" ? form.periodUnit : null, periodCount: form.mode === "RECURRING" ? form.periodCount : null, ...(edit ? { revision: edit.revision } : {}) }),
      });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Не удалось сохранить тариф.");
      setNotice("Тариф сохранён. Это не создало заказ, подписку или банковское списание."); setEdit(null); setForm(empty); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Сохранение не выполнено."); }
    finally { setBusy(false); }
  }
  return <section className="mt-10 space-y-6" aria-labelledby="billing-title">
    <h2 id="billing-title" className="type-h2 break-words">Тарифы и рекуррентные услуги</h2>
    <div className="panel space-y-3 p-6"><p className="type-body">Создавайте описания разовых услуг и подписочных тарифов, включая Premium/VPN.</p><p className="type-ui text-muted">Приём оплаты и автоматические списания не включены. Эквайринг Т-Банка и выдача Premium/VPN требуют следующего этапа интеграции. Публикация тарифа лишь показывает его на сайте.</p><a className="button-secondary" href="/plans" target="_blank" rel="noopener noreferrer">Открыть публичные тарифы</a></div>
    {error ? <p role="alert" className="panel p-4 text-danger">{error}</p> : null}{notice ? <p role="status" className="panel p-4 text-success">{notice}</p> : null}
    <form id="billing-plan-form" className="panel space-y-5 p-6" onSubmit={save}>
      <h3 className="type-h3">{edit ? `Редактировать тариф · версия ${edit.revision}` : "Создать тариф"}</h3>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block type-ui">Продукт<select className="field mt-2" value={form.kind} onChange={e => { field("kind", e.target.value as PlanForm["kind"]); field("serviceId", ""); }}>{Object.entries(PLAN_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {form.kind === "SERVICE" ? <label className="block type-ui">Услуга<select className="field mt-2" required value={form.serviceId} onChange={e => field("serviceId", e.target.value)}><option value="">Выберите услугу</option>{services.map(service => <option key={service.id} value={service.id}>{service.title}{service.isPublished ? "" : " · черновик"}</option>)}</select></label> : <p className="type-ui text-muted self-center">Тариф для основного проекта. Публикация не выдаёт Premium/VPN-доступ.</p>}
        <label className="block type-ui">Название<input className="field mt-2" required minLength={2} maxLength={160} value={form.title} onChange={e => field("title", e.target.value)} /></label>
        <label className="block type-ui">Тип оплаты<select className="field mt-2" value={form.mode} onChange={e => field("mode", e.target.value as PlanForm["mode"])}><option value="ONE_TIME">Разовая услуга</option><option value="RECURRING">Рекуррентная / подписочная услуга</option></select></label>
        <label className="block type-ui">Цена в рублях<input className="field mt-2" inputMode="decimal" placeholder="Не задана" maxLength={30} value={form.amountRub} onChange={e => field("amountRub", e.target.value)} /><span className="mt-1 block text-subtle">В черновике можно не указывать. Цены не создаются автоматически.</span></label>
        {form.mode === "RECURRING" ? <div className="grid grid-cols-2 gap-3"><label className="block type-ui">Каждые<input className="field mt-2" type="number" required min={1} max={365} value={form.periodCount} onChange={e => field("periodCount", Number(e.target.value))} /></label><label className="block type-ui">Период<select className="field mt-2" value={form.periodUnit} onChange={e => field("periodUnit", e.target.value as PlanForm["periodUnit"])}>{Object.entries(PERIOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div> : null}
      </div>
      <label className="block type-ui">Описание услуги и состав работ<textarea className="field mt-2 min-h-32" required minLength={10} maxLength={5000} value={form.description} onChange={e => field("description", e.target.value)} /></label>
      {form.mode === "RECURRING" ? <label className="block type-ui">Условия автопродления и списаний<textarea className="field mt-2 min-h-32" required minLength={10} maxLength={5000} value={form.renewalTerms} onChange={e => field("renewalTerms", e.target.value)} /><span className="mt-1 block text-subtle">Опишите период, цену, уведомления и порядок изменения условий. Это описание тарифа, не полученное согласие клиента.</span></label> : null}
      <label className="block type-ui">Условия отмены и возврата<textarea className="field mt-2 min-h-24" maxLength={5000} value={form.cancellationTerms} onChange={e => field("cancellationTerms", e.target.value)} /><span className="mt-1 block text-subtle">Для публикации требуется утверждённый владельцем текст.</span></label>
      <label className="block type-ui">Внутренняя заметка (не публикуется)<textarea className="field mt-2" maxLength={5000} value={form.internalNotes} onChange={e => field("internalNotes", e.target.value)} /></label>
      <div className="flex flex-wrap gap-5 type-ui"><label className="flex gap-2"><input type="checkbox" checked={form.isPublished} onChange={e => field("isPublished", e.target.checked)} />Опубликовать информацию</label><label className="flex gap-2"><input type="checkbox" checked={form.isArchived} onChange={e => { field("isArchived", e.target.checked); if (e.target.checked) field("isPublished", false); }} />Архивировать</label></div>
      <div className="flex flex-wrap gap-3"><button className="button-primary" disabled={busy} type="submit">{busy ? "Сохраняем…" : "Сохранить тариф"}</button>{edit ? <button className="button-secondary" type="button" disabled={busy} onClick={() => { setEdit(null); setForm(empty); }}>Отменить редактирование</button> : null}</div>
    </form>
    <div className="grid gap-4 lg:grid-cols-2">{plans.map(plan => <article className="panel space-y-3 p-5" key={plan.id}><p className="eyebrow">{PLAN_KIND_LABELS[plan.kind]} · {plan.mode === "RECURRING" ? "Подписочная" : "Разовая"}</p><h3 className="type-h3 break-words">{plan.title}</h3><p className="type-ui text-muted">{plan.amountMinor === null ? "Цена не задана" : `${minorToRubles(plan.amountMinor)} ₽`}{plan.mode === "RECURRING" && plan.periodUnit ? ` / каждые ${plan.periodCount} ${PERIOD_LABELS[plan.periodUnit]}` : ""}</p><p className="type-ui text-subtle">{plan.isArchived ? "Архив" : plan.isPublished ? "Опубликован" : "Черновик"} · версия {plan.revision}</p><button type="button" className="button-secondary" disabled={busy} onClick={() => select(plan)}>Редактировать</button></article>)}</div>
    {!plans.length ? <p className="type-body text-muted">Тарифов пока нет. Существующие услуги, клиенты и заявки не изменены.</p> : null}
  </section>;
}
