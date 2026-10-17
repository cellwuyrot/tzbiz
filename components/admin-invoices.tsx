"use client";
import { useCallback, useEffect, useState } from "react";
import { adminFetch, adminMutation } from "@/lib/admin-fetch";
import { INVOICE_METHODS, INVOICE_STATUSES } from "@/lib/invoices";
type Client = { id: string; name: string; email: string };
type Invoice = {
  id: string;
  number: string;
  title: string;
  amountMinor: number;
  buyerName: string;
  method: keyof typeof INVOICE_METHODS;
  status: keyof typeof INVOICE_STATUSES;
  revision: number;
  createdAt: string;
  paymentReference: string;
};
const blank = () => ({
  userId: "",
  orderId: "",
  method: "BANK_TRANSFER" as keyof typeof INVOICE_METHODS,
  title: "",
  amountRub: "",
  buyerName: "",
  buyerInn: "",
  buyerDetails: "",
  taxNote: "",
  dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  paymentUrl: "",
  periodMonths: 1,
  renewalTerms: "",
  providerConfirmed: false,
});
export function AdminInvoices({ clients }: { clients: Client[] }) {
  const [form, setForm] = useState(blank),
    [invoices, setInvoices] = useState<Invoice[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [q, setQ] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [requestKey, setRequestKey] = useState("");
  const [ready, setReady] = useState({
    bankReady: false,
    termsApproved: false,
    paymentHosts: [] as string[],
  });
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const d = await adminFetch<{
          invoices: Invoice[];
          total: number;
          bankReady: boolean;
          termsApproved: boolean;
          paymentHosts: string[];
        }>(`/api/admin/invoices?page=${page}&q=${encodeURIComponent(q)}`, {
          signal,
        });
        if (!signal?.aborted) {
          setInvoices(d.invoices);
          setTotal(d.total);
          setReady(d);
        }
      } catch (e) {
        if (!signal?.aborted)
          setError(
            e instanceof Error ? e.message : "Не удалось загрузить счета.",
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, q],
  );
  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);
  function field<K extends keyof ReturnType<typeof blank>>(
    key: K,
    value: ReturnType<typeof blank>[K],
  ) {
    setForm((p) => ({ ...p, [key]: value }));
    setRequestKey("");
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const key = requestKey || crypto.randomUUID();
    setRequestKey(key);
    try {
      await adminMutation("/api/admin/invoices", "POST", {
        ...form,
        requestKey: key,
        orderId: form.orderId || null,
        periodMonths: form.method === "RECURRING" ? form.periodMonths : null,
        paymentUrl: form.method === "BANK_TRANSFER" ? "" : form.paymentUrl,
      });
      setForm(blank());
      setRequestKey("");
      setNotice("Счёт выставлен и доступен клиенту в аккаунте.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выставить счёт.");
    } finally {
      setBusy(false);
    }
  }
  async function close(invoice: Invoice, action: "PAID" | "CANCELLED") {
    const reference =
      action === "PAID"
        ? prompt(
            "Номер банковской операции или транзакции провайдера после сверки поступления:",
          )
        : "";
    if (reference === null) return;
    if (
      !confirm(
        action === "PAID"
          ? "Подтвердить фактически полученную оплату? Это ручная сверка, не банковская проверка и не активация подписки."
          : "Отменить счёт? Внешнюю платёжную ссылку или подписку необходимо отдельно отключить у провайдера.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await adminMutation(`/api/admin/invoices/${invoice.id}`, "PATCH", {
        action,
        reference,
        revision: invoice.revision,
        confirm: true,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Операция не выполнена.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 space-y-6" aria-labelledby="invoices-title">
      <h2 className="type-h2" id="invoices-title">
        Счета
      </h2>
      {error && (
        <p className="panel p-4 text-danger" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="panel p-4 text-success" role="status">
          {notice}
        </p>
      )}
      {!loading && !ready.termsApproved && (
        <p className="panel p-4 text-danger" role="status">
          Выставление закрыто: утвердите продавца и условия в разделе «Продажи и
          условия».
        </p>
      )}
      <form
        onSubmit={create}
        className="panel p-5 sm:p-6 grid gap-5 sm:grid-cols-2"
      >
        <label className="block type-ui">
          Клиент
          <select
            className="field mt-2"
            required
            value={form.userId}
            onChange={(e) => {
              const c = clients.find((c) => c.id === e.target.value);
              field("userId", e.target.value);
              field("buyerName", c?.name || "");
            }}
          >
            <option value="">Выберите клиента</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.email}
              </option>
            ))}
          </select>
        </label>
        <label className="block type-ui">
          Способ оплаты
          <select
            className="field mt-2"
            value={form.method}
            onChange={(e) => {
              field("method", e.target.value as typeof form.method);
              field("providerConfirmed", false);
            }}
          >
            {Object.entries(INVOICE_METHODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["title", "Услуга / назначение"],
            ["amountRub", "Сумма, ₽"],
            ["buyerName", "Плательщик: организация, ИП или ФИО"],
            ["buyerInn", "ИНН плательщика"],
            ["buyerDetails", "Реквизиты и адрес плательщика"],
            ["taxNote", "НДС: ставка и сумма либо основание без НДС"],
            ["orderId", "ID тарифной заявки (необязательно)"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className={`block type-ui ${key === "title" || key === "buyerDetails" ? "sm:col-span-2" : ""}`}
          >
            {label}
            <input
              className="field mt-2"
              required={["title", "amountRub", "buyerName", "taxNote"].includes(
                key,
              )}
              maxLength={
                key === "buyerDetails" ? 3000 : key === "orderId" ? 40 : 300
              }
              inputMode={
                key === "amountRub"
                  ? "decimal"
                  : key === "buyerInn"
                    ? "numeric"
                    : "text"
              }
              value={form[key]}
              onChange={(e) => field(key, e.target.value)}
            />
          </label>
        ))}
        <label className="block type-ui">
          Срок оплаты
          <input
            className="field mt-2"
            type="date"
            required
            min={new Date().toISOString().slice(0, 10)}
            value={form.dueDate}
            onChange={(e) => field("dueDate", e.target.value)}
          />
        </label>
        {form.method === "BANK_TRANSFER" && !ready.bankReady && !loading && (
          <p className="type-ui text-danger">
            Заполните банковские реквизиты продавца в разделе «Продажи и
            условия».
          </p>
        )}
        {form.method !== "BANK_TRANSFER" && (
          <>
            <label className="block type-ui sm:col-span-2">
              Платёжная ссылка провайдера
              <input
                className="field mt-2"
                type="url"
                required
                maxLength={2000}
                value={form.paymentUrl}
                onChange={(e) => field("paymentUrl", e.target.value)}
              />
            </label>
            {!ready.paymentHosts.length && (
              <p className="type-ui text-danger sm:col-span-2">
                Внешняя оплата отключена: на сервере не настроен
                PAYMENT_LINK_HOSTS.
              </p>
            )}
            <label className="flex gap-3 type-ui sm:col-span-2">
              <input
                type="checkbox"
                required
                checked={form.providerConfirmed}
                onChange={(e) => field("providerConfirmed", e.target.checked)}
              />
              <span>
                Ссылка создана в кабинете провайдера для этого клиента. Сумма и
                валюта сверены; для подписки проверены период, согласие на
                списания и способ отмены.
              </span>
            </label>
          </>
        )}
        {form.method === "RECURRING" && (
          <>
            <label className="block type-ui">
              Период, месяцев
              <input
                className="field mt-2"
                type="number"
                min={1}
                max={12}
                required
                value={form.periodMonths}
                onChange={(e) => field("periodMonths", Number(e.target.value))}
              />
            </label>
            <label className="block type-ui sm:col-span-2">
              Продление и отмена
              <textarea
                className="field mt-2 min-h-28"
                required
                minLength={20}
                maxLength={3000}
                value={form.renewalTerms}
                onChange={(e) => field("renewalTerms", e.target.value)}
              />
            </label>
          </>
        )}
        <button
          className="button-primary sm:col-span-2"
          disabled={
            busy ||
            loading ||
            !ready.termsApproved ||
            (form.method === "BANK_TRANSFER"
              ? !ready.bankReady
              : !ready.paymentHosts.length)
          }
          type="submit"
        >
          {busy ? "Сохранение…" : "Выставить счёт"}
        </button>
      </form>
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
          aria-label="Поиск счетов"
          placeholder="Номер, плательщик или услуга"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="button-secondary" type="submit">
          Найти
        </button>
        <button
          className="button-secondary"
          type="button"
          disabled={loading || busy}
          onClick={() => void load()}
        >
          Обновить
        </button>
      </form>
      <p role="status" className="type-ui text-muted">
        {loading ? "Загрузка…" : `Счетов: ${total}`}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {invoices.map((i) => (
          <article key={i.id} className="panel admin-card space-y-4">
            <div className="admin-toolbar">
              <span className="status-pill">{INVOICE_STATUSES[i.status]}</span>
              <span className="type-ui text-muted">
                {INVOICE_METHODS[i.method]}
              </span>
            </div>
            <h3 className="type-h3 break-words">{i.title}</h3>
            <p className="type-ui break-all">{i.number}</p>
            <p className="type-body">
              {i.buyerName} ·{" "}
              {new Intl.NumberFormat("ru-RU", {
                style: "currency",
                currency: "RUB",
              }).format(i.amountMinor / 100)}
            </p>
            {i.paymentReference && (
              <p className="type-ui">Операция: {i.paymentReference}</p>
            )}
            <div className="admin-toolbar">
              <a
                className="button-secondary"
                href={`/invoices/${i.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Открыть / печать
              </a>
              {i.status === "ISSUED" && (
                <>
                  <button
                    className="button-secondary"
                    disabled={busy}
                    onClick={() => void close(i, "PAID")}
                  >
                    Сверить поступление
                  </button>
                  <button
                    className="button-secondary text-danger"
                    disabled={busy}
                    onClick={() => void close(i, "CANCELLED")}
                  >
                    Отменить счёт
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      {!loading && !invoices.length && (
        <p className="panel p-5 type-body text-muted">Счета не найдены.</p>
      )}
      <div className="admin-toolbar">
        <button
          className="button-secondary"
          disabled={page === 1 || loading || busy}
          onClick={() => setPage(page - 1)}
        >
          Назад
        </button>
        <span className="type-ui">
          Страница {page} из {Math.max(1, Math.ceil(total / 20))}
        </span>
        <button
          className="button-secondary"
          disabled={page * 20 >= total || loading || busy}
          onClick={() => setPage(page + 1)}
        >
          Далее
        </button>
      </div>
    </section>
  );
}
