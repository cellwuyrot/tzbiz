"use client";
import { renameDisplayText } from "@/lib/display-labels";
import { readAdminResponse } from "@/lib/admin-fetch";
import { useCallback, useEffect, useState } from "react";
import {
  PLAN_KIND_LABELS,
  PERIOD_LABELS,
  SETTLEMENT_LABELS,
  minorToRubles,
} from "@/lib/billing/plan";
type Form = {
  kind: "SERVICE" | "PREMIUM" | "VPN";
  serviceId: string;
  title: string;
  description: string;
  settlementMode: keyof typeof SETTLEMENT_LABELS;
  externalProductId: string;
  amountRub: string;
  periodUnit: keyof typeof PERIOD_LABELS;
  periodCount: number;
  renewalTerms: string;
  cancellationTerms: string;
  internalNotes: string;
  isPublished: boolean;
  isArchived: boolean;
};
type Saved = Omit<
  Form,
  "amountRub" | "serviceId" | "periodUnit" | "periodCount"
> & {
  id: string;
  revision: number;
  amountMinor: number | null;
  serviceId: string | null;
  periodUnit: Form["periodUnit"] | null;
  periodCount: number | null;
};
const blank: Form = {
  kind: "SERVICE",
  serviceId: "",
  title: "",
  description: "",
  settlementMode: "NO_PREPAYMENT",
  externalProductId: "",
  amountRub: "",
  periodUnit: "MONTH",
  periodCount: 1,
  renewalTerms: "",
  cancellationTerms: "",
  internalNotes: "",
  isPublished: false,
  isArchived: false,
};
export function AdminBillingPlans() {
  const [plans, setPlans] = useState<Saved[]>([]),
    [services, setServices] = useState<
      { id: string; title: string; isPublished: boolean }[]
    >([]),
    [form, setForm] = useState<Form>(blank),
    [edit, setEdit] = useState<{ id: string; revision: number } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [filter, setFilter] = useState("ALL");
  const refresh = useCallback(async () => {
    const r = await fetch("/api/admin/billing/plans", { cache: "no-store" });
    const d = await readAdminResponse<{
      plans: Saved[];
      services: { id: string; title: string; isPublished: boolean }[];
    }>(r);
    setPlans(d.plans);
    setServices(d.services);
  }, []);
  useEffect(() => {
    refresh().catch((cause) =>
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось загрузить предложения.",
      ),
    );
  }, [refresh]);
  function field<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }
  function select(p: Saved) {
    setForm({
      ...p,
      settlementMode: p.kind === "SERVICE" ? p.settlementMode : "SUBSCRIPTION",
      amountRub: minorToRubles(p.amountMinor),
      serviceId: p.serviceId || "",
      periodUnit: p.periodUnit || "MONTH",
      periodCount: p.periodCount || 1,
    });
    setEdit({ id: p.id, revision: p.revision });
    setError("");
    setNotice("");
    document
      .getElementById("billing-plan-form")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const c = await fetch("/api/auth/csrf");
      if (!c.ok) throw Error("Обновите страницу: CSRF недоступен.");
      const { token } = await c.json();
      const r = await fetch(
        edit
          ? `/api/admin/billing/plans/${edit.id}`
          : "/api/admin/billing/plans",
        {
          method: edit ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": token,
          },
          body: JSON.stringify({
            ...form,
            currency: "RUB",
            mode:
              form.settlementMode === "SUBSCRIPTION" ? "RECURRING" : "ONE_TIME",
            serviceId: form.kind === "SERVICE" ? form.serviceId || null : null,
            periodUnit:
              form.settlementMode === "SUBSCRIPTION" ? form.periodUnit : null,
            periodCount:
              form.settlementMode === "SUBSCRIPTION" ? form.periodCount : null,
            ...(edit ? { revision: edit.revision } : {}),
          }),
        },
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось сохранить.");
      setNotice(
        "Предложение сохранено. История условий и уже созданные заказы не изменены.",
      );
      setEdit(null);
      setForm(blank);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения.");
    } finally {
      setBusy(false);
    }
  }
  const sub = form.settlementMode === "SUBSCRIPTION";
  return (
    <section className="mt-8 space-y-6" aria-labelledby="billing-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="billing-title" className="type-h2 mt-2">
            Тарифы и подписки
          </h2>
        </div>
        <a
          className="button-secondary"
          href="/plans"
          target="_blank"
          rel="noopener noreferrer"
        >
          Посмотреть витрину ↗
        </a>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(SETTLEMENT_LABELS).map(([k, v]) => (
          <div key={k} className="panel p-5">
            <p className="type-ui text-muted">{v}</p>
            <p className="type-h2 mt-2">
              {
                plans.filter((p) => p.settlementMode === k && !p.isArchived)
                  .length
              }
            </p>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="panel p-4 text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="panel p-4 text-success">
          {notice}
        </p>
      )}
      <form
        id="billing-plan-form"
        onSubmit={save}
        className="panel space-y-6 p-5 sm:p-8"
      >
        <h3 className="type-h3">
          {edit
            ? `Редактирование · версия ${edit.revision}`
            : "Новое предложение"}
        </h3>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="type-ui">
            Продукт
            <select
              className="field mt-2"
              value={form.kind}
              onChange={(e) => {
                const kind = e.target.value as Form["kind"];
                setForm((p) => ({
                  ...p,
                  kind,
                  serviceId: "",
                  externalProductId: "",
                  settlementMode:
                    kind === "SERVICE" ? "NO_PREPAYMENT" : "SUBSCRIPTION",
                }));
              }}
            >
              {Object.entries(PLAN_KIND_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="type-ui">
            Режим оплаты
            <select
              className="field mt-2"
              value={form.settlementMode}
              onChange={(e) =>
                field(
                  "settlementMode",
                  e.target.value as Form["settlementMode"],
                )
              }
            >
              {Object.entries(SETTLEMENT_LABELS)
                .filter(
                  ([k]) => form.kind === "SERVICE" || k === "SUBSCRIPTION",
                )
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
          </label>
          {form.kind === "SERVICE" ? (
            <label className="type-ui">
              Услуга в каталоге
              <select
                className="field mt-2"
                required
                value={form.serviceId}
                onChange={(e) => field("serviceId", e.target.value)}
              >
                <option value="">Выберите услугу</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                    {s.isPublished ? "" : " · черновик"}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="type-ui">
              Технический ID продукта TZ ID
              <input
                className="field mt-2"
                maxLength={160}
                value={form.externalProductId}
                onChange={(e) => field("externalProductId", e.target.value)}
                placeholder="Точное значение из платформы"
              />
            </label>
          )}
          <label className="type-ui">
            Название на витрине
            <input
              className="field mt-2"
              required
              minLength={2}
              maxLength={160}
              value={form.title}
              onChange={(e) => field("title", e.target.value)}
            />
          </label>
          <label className="type-ui">
            {form.settlementMode === "NO_PREPAYMENT"
              ? "Стоимость (можно согласовать позже)"
              : "Стоимость, ₽"}
            <input
              className="field mt-2"
              inputMode="decimal"
              maxLength={30}
              value={form.amountRub}
              onChange={(e) => field("amountRub", e.target.value)}
              placeholder={
                form.settlementMode === "NO_PREPAYMENT"
                  ? "По согласованию"
                  : "Например, 1500,00"
              }
            />
          </label>
          {sub && (
            <div className="grid grid-cols-2 gap-3">
              <label className="type-ui">
                Каждые
                <input
                  className="field mt-2"
                  type="number"
                  required
                  min={1}
                  max={365}
                  value={form.periodCount}
                  onChange={(e) => field("periodCount", Number(e.target.value))}
                />
              </label>
              <label className="type-ui">
                Период
                <select
                  className="field mt-2"
                  value={form.periodUnit}
                  onChange={(e) =>
                    field("periodUnit", e.target.value as Form["periodUnit"])
                  }
                >
                  {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
        <label className="block type-ui">
          Описание и состав услуги
          <textarea
            className="field mt-2 min-h-32"
            required
            minLength={10}
            maxLength={5000}
            value={form.description}
            onChange={(e) => field("description", e.target.value)}
          />
        </label>
        {sub && (
          <label className="block type-ui">
            Продление и списания
            <textarea
              className="field mt-2 min-h-24"
              required
              minLength={10}
              maxLength={5000}
              value={form.renewalTerms}
              onChange={(e) => field("renewalTerms", e.target.value)}
            />
          </label>
        )}
        <label className="block type-ui">
          Отмена, возврат и условия обращения
          <textarea
            className="field mt-2 min-h-24"
            maxLength={5000}
            value={form.cancellationTerms}
            onChange={(e) => field("cancellationTerms", e.target.value)}
          />
        </label>
        <label className="block type-ui">
          Внутренняя заметка
          <textarea
            className="field mt-2"
            maxLength={5000}
            value={form.internalNotes}
            onChange={(e) => field("internalNotes", e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-5 type-ui">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => field("isPublished", e.target.checked)}
            />
            Опубликовать
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.isArchived}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  isArchived: e.target.checked,
                  isPublished: e.target.checked ? false : p.isPublished,
                }))
              }
            />
            В архив
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="button-primary" disabled={busy}>
            {busy ? "Сохраняем…" : "Сохранить предложение"}
          </button>
          {edit && (
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setEdit(null);
                setForm(blank);
              }}
            >
              Отменить
            </button>
          )}
        </div>
      </form>
      <label className="block max-w-sm type-ui">
        Показать
        <select
          className="field mt-2"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">Все предложения</option>
          {Object.entries(SETTLEMENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 lg:grid-cols-2">
        {plans
          .filter((p) => filter === "ALL" || p.settlementMode === filter)
          .map((p) => (
            <article key={p.id} className="panel space-y-4 p-6">
              <p className="eyebrow">
                {PLAN_KIND_LABELS[p.kind]} ·{" "}
                {SETTLEMENT_LABELS[p.settlementMode]}
              </p>
              <h3 className="type-h3 break-words">
                {renameDisplayText(p.title)}
              </h3>
              <p className="type-lead">
                {p.amountMinor === null
                  ? "По согласованию"
                  : `${minorToRubles(p.amountMinor)} ₽`}
                {p.periodUnit
                  ? ` / ${p.periodCount} ${PERIOD_LABELS[p.periodUnit]}`
                  : ""}
              </p>
              <p className="type-ui text-muted">
                {p.isArchived
                  ? "Архив"
                  : p.isPublished
                    ? "Опубликовано"
                    : "Черновик"}{" "}
                · версия {p.revision}
              </p>
              <button
                type="button"
                className="button-secondary"
                onClick={() => select(p)}
              >
                Редактировать
              </button>
            </article>
          ))}
      </div>
      {!plans.length && (
        <p className="panel p-5 type-body text-muted">Предложений пока нет.</p>
      )}
    </section>
  );
}
