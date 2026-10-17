"use client";
import { renameDisplayText } from "@/lib/display-labels";
import { adminFetch } from "@/lib/admin-fetch";
import { useCallback, useEffect, useState } from "react";
import { ORDER_STATUS, canTransition } from "@/lib/commerce-client";
type Settings = {
  sellerInn: string;
  sellerKpp: string;
  bankName: string;
  bankBik: string;
  bankAccount: string;
  bankCorrespondentAccount: string;
  sellerName: string;
  sellerDetails: string;
  supportEmail: string;
  paymentInstructions: string;
  fulfillmentTerms: string;
  refundTerms: string;
  approved: boolean;
  revision: number;
};
const empty: Settings = {
  sellerInn: "",
  sellerKpp: "",
  bankName: "",
  bankBik: "",
  bankAccount: "",
  bankCorrespondentAccount: "",
  sellerName: "",
  sellerDetails: "",
  supportEmail: "info@trioz.ru",
  paymentInstructions: "",
  fulfillmentTerms: "",
  refundTerms: "",
  approved: false,
  revision: 0,
};
type Order = {
  id: string;
  paymentConfirmed: boolean;
  title: string;
  settlementMode: string;
  amountMinor: number | null;
  currency: string;
  status: keyof typeof ORDER_STATUS;
  message: string;
  planRevision: number;
  createdAt: string;
  updatedAt: string;
  user: { name: string; email: string };
};
export function AdminCommerce() {
  const [form, setForm] = useState(empty),
    [orders, setOrders] = useState<Order[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [query, setQuery] = useState(""),
    [q, setQ] = useState("");
  const load = useCallback(async () => {
    const [s, o] = await Promise.all([
      adminFetch<{ settings: Settings | null }>("/api/admin/commerce"),
      adminFetch<{ orders: Order[]; total: number }>(
        `/api/admin/orders?page=${page}&q=${encodeURIComponent(q)}&status=${filter}`,
      ),
    ]);
    setForm(s.settings || empty);
    setOrders(o.orders);
    setTotal(o.total);
  }, [page, q, filter]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  async function mutate(url: string, method: string, body: unknown) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const c = await fetch("/api/auth/csrf");
      if (!c.ok) throw Error("CSRF недоступен.");
      const { token } = await c.json();
      const r = await fetch(url, {
        method,
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Ошибка сохранения.");
      await load();
      setNotice("Изменения сохранены.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 space-y-8">
      <div>
        <h2 className="type-h2 mt-2">Контроль оформления</h2>
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
      <details className="panel p-5 sm:p-8" open={!form.approved}>
        <summary className="type-h3 cursor-pointer">
          Продавец и условия ·{" "}
          {form.approved ? "утверждены" : "нужна настройка"}
        </summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutate("/api/admin/commerce", "PUT", form);
          }}
          className="mt-6 grid gap-5"
        >
          {(
            [
              ["sellerName", "Полное наименование продавца"],
              ["sellerInn", "ИНН продавца"],
              ["sellerKpp", "КПП продавца"],
              ["bankName", "Банк получателя"],
              ["bankBik", "БИК"],
              ["bankAccount", "Расчётный счёт"],
              ["bankCorrespondentAccount", "Корреспондентский счёт"],
              ["sellerDetails", "Реквизиты и адрес"],
              ["supportEmail", "Email для обращений"],
              ["paymentInstructions", "Порядок оплаты / выставления счёта"],
              ["fulfillmentTerms", "Сроки и порядок предоставления услуги"],
              ["refundTerms", "Условия отмены и возврата"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block type-ui">
              {label}
              {![
                "sellerDetails",
                "paymentInstructions",
                "fulfillmentTerms",
                "refundTerms",
              ].includes(key) ? (
                <input
                  type={key === "supportEmail" ? "email" : "text"}
                  inputMode={
                    [
                      "sellerInn",
                      "sellerKpp",
                      "bankBik",
                      "bankAccount",
                      "bankCorrespondentAccount",
                    ].includes(key)
                      ? "numeric"
                      : undefined
                  }
                  maxLength={
                    key === "sellerName" || key === "bankName"
                      ? 300
                      : key === "supportEmail"
                        ? 254
                        : key === "sellerInn"
                          ? 12
                          : key === "sellerKpp" || key === "bankBik"
                            ? 9
                            : 20
                  }
                  className="field mt-2"
                  required={key === "supportEmail"}
                  value={form[key]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [key]: e.target.value }))
                  }
                />
              ) : (
                <textarea
                  className="field mt-2 min-h-24"
                  maxLength={key === "sellerName" ? 300 : 5000}
                  value={form[key]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [key]: e.target.value }))
                  }
                />
              )}
            </label>
          ))}
          <label className="flex gap-3 type-ui">
            <input
              type="checkbox"
              checked={form.approved}
              onChange={(e) =>
                setForm((p) => ({ ...p, approved: e.target.checked }))
              }
            />
            <span>
              Подтверждаю, что сведения и условия проверены владельцем. Открыть
              оформление заявок на тарифы.
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="button-primary">
              Сохранить условия
            </button>
            <a
              href="/payment"
              target="_blank"
              rel="noopener noreferrer"
              className="button-secondary"
            >
              Посмотреть страницу оплаты ↗
            </a>
          </div>
        </form>
      </details>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h3 className="type-h3">Последние заявки на тарифы</h3>
        <label className="type-ui">
          Статус
          <select
            className="field mt-2"
            value={filter}
            onChange={(e) => {
              setPage(1);
              setFilter(e.target.value);
            }}
          >
            <option value="ALL">Все</option>
            {Object.entries(ORDER_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
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
          aria-label="Поиск тарифных заявок"
          placeholder="Клиент или услуга"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="button-secondary" type="submit">
          Найти
        </button>
        <button
          className="button-secondary"
          type="button"
          onClick={() => load().catch((e) => setError(e.message))}
        >
          Обновить
        </button>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {orders
          .filter((o) => filter === "ALL" || o.status === filter)
          .map((o) => (
            <article key={o.id} className="panel space-y-4 p-6">
              <div className="flex flex-wrap justify-between gap-3">
                <span className="status-pill">{ORDER_STATUS[o.status]}</span>
                <span className="type-ui text-subtle">
                  {new Date(o.createdAt).toLocaleDateString("ru-RU")}
                </span>
              </div>
              <h4 className="type-h3 break-words">
                {renameDisplayText(o.title)}
              </h4>
              <p className="type-ui text-muted break-words">
                {o.user.name} · {o.user.email}
              </p>
              <p className="type-body">
                {o.amountMinor === null
                  ? "Стоимость согласуется"
                  : new Intl.NumberFormat("ru-RU", {
                      style: "currency",
                      currency: o.currency,
                    }).format(o.amountMinor / 100)}{" "}
                · версия тарифа {o.planRevision}
              </p>
              <p className="type-body whitespace-pre-wrap break-words text-muted">
                {o.message}
              </p>
              <p className="type-ui text-subtle break-all">№ {o.id}</p>
              <label className="block type-ui">
                Рабочий статус
                <select
                  className="field mt-2"
                  disabled={busy}
                  value={o.status}
                  onChange={(e) =>
                    mutate(`/api/admin/orders/${o.id}`, "PATCH", {
                      status: e.target.value,
                      updatedAt: o.updatedAt,
                    })
                  }
                >
                  {Object.entries(ORDER_STATUS)
                    .filter(
                      ([k]) =>
                        k === o.status ||
                        canTransition(
                          o.settlementMode,
                          o.status,
                          k,
                          o.paymentConfirmed,
                        ),
                    )
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                </select>
              </label>
            </article>
          ))}
      </div>
      {!orders.length && (
        <div className="panel p-8 type-body text-muted">
          Заявки на тарифы не найдены.
        </div>
      )}
      <div className="admin-toolbar">
        <button
          className="button-secondary"
          disabled={page === 1 || busy}
          onClick={() => setPage(page - 1)}
        >
          Назад
        </button>
        <span className="type-ui">
          Страница {page} из {Math.max(1, Math.ceil(total / 20))}
        </span>
        <button
          className="button-secondary"
          disabled={page * 20 >= total || busy}
          onClick={() => setPage(page + 1)}
        >
          Далее
        </button>
      </div>
    </section>
  );
}
