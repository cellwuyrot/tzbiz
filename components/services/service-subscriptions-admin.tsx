"use client";
import { useEffect, useState, useCallback } from "react";
import { adminFetch, adminMutation } from "@/lib/admin-fetch";
type Cycle = { id: string; subscriptionId: string; paymentId: string | null; status: string; amountMinor: number };
type Sub = { id: string; userId: string; title: string; status: string; method: string; amountMinor: number; months: number; syncPending: boolean; trustUntil?: string | null; paidUntil?: string | null };
const labels: Record<string, string> = { CREATING: "Результат создания уточняется", CHARGING: "Списание требует сверки", INITIALIZED: "Списание не подтверждено", NEW: "Платёж создан; оплаты пока нет", FORM_SHOWED: "Форма открыта; подтверждение ожидается", AUTHORIZED: "Авторизован; ждём подтверждения", AWAITING_INVOICE: "Ожидает оплаты счёта", PENDING: "Ожидает оплаты", TRUSTED: "Доверительный доступ — оплата ожидается", ACTIVE: "Период оплачен", EXPIRED: "Доступ по заявке завершён", CANCELED: "Отменена" };
export function ServiceSubscriptionsAdmin() {
  const [rows, setRows] = useState<Sub[]>([]), [cycles, setCycles] = useState<Cycle[]>([]);
  const [bankIds, setBankIds] = useState<Record<string, string>>({}), [references, setReferences] = useState<Record<string, string>>({});
  const [hours, setHours] = useState(24), [savedHours, setSavedHours] = useState(24), [notices, setNotices] = useState(0);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [updated, setUpdated] = useState("");
  const load = useCallback(async (initial = false) => {
    const d = await adminFetch<{ subscriptions: Sub[]; unresolved: Cycle[]; notices: number; trustHours: number; refreshedAt: string }>("/api/admin/service-subscriptions");
    setRows(d.subscriptions); setCycles(d.unresolved); setNotices(d.notices); setUpdated(d.refreshedAt);
    setSavedHours(d.trustHours); if (initial) setHours(d.trustHours);
  }, []);
  useEffect(() => {
    void load(true).catch(e => setError(e.message));
    const refresh = () => { if (document.visibilityState === "visible") void load().catch(e => setError(e.message)); };
    const timer = setInterval(refresh, 30000); window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);
  async function action(body: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try { await adminMutation("/api/admin/service-subscriptions", "POST", body); await load(); setNotice("Данные сохранены. Сверка не создаёт нового списания."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="site-shell pb-12 space-y-5">
    <header><h2 className="type-h3">Оплаты и контроль подключения</h2><p className="mt-2 type-ui text-muted">Статус банка, оплаченный период и доступ — отдельные состояния. Обновление каждые 30 секунд.</p></header>
    {error && <p role="alert" className="panel p-4 text-danger">{error}</p>}{notice && <p role="status" className="panel p-4">{notice}</p>}
    <form className="panel p-5 space-y-3" onSubmit={e => { e.preventDefault(); void action({ action: "trustPolicy", hours }); }}>
      <h3 className="font-semibold">Доверительный доступ</h3><p>После подтверждённого создания платежа в банке соединение или Premium можно подключить до оплаты. По умолчанию — 24 часа, один раз на аккаунт TZ ID и услугу.</p>
      <label className="block">Срок для новых подключений, часов<input className="field mt-2" type="number" min={0} max={168} required value={hours} onChange={e => setHours(Number(e.target.value))} /></label>
      <p className="type-ui text-muted">0 — отключить. Сохранено: {savedHours} ч. Уже выданные сроки не меняются. При отказе банка или истечении срока отзывается только временное право. Действующий оплаченный или ручной доступ сохраняется. Услуги с физическим исполнением не подключаются в кредит.</p>
      <button className="button-primary" disabled={busy}>Сохранить срок</button>
    </form>
    <div className="flex flex-wrap gap-3 items-center"><button className="button-secondary" disabled={busy} onClick={() => void load().then(() => setError("")).catch(e => setError(e.message))}>Обновить</button><p className="type-ui">Ожидают результата банка: {cycles.length}. Писем с неопределённой доставкой: {notices}.{updated ? ` Обновлено: ${new Date(updated).toLocaleString("ru-RU")}.` : ""}</p></div>
    <p className="type-ui text-muted">Не повторяйте спорное списание. Кнопка сверки ниже вызывает только GetState. Истечение доверительного срока не означает отмену операции в банке или возврат денег.</p>
    {cycles.map(c => <form key={c.id} className="panel p-5 space-y-3" onSubmit={e => { e.preventDefault(); void action({ action: "reconcile", cycleId: c.id, paymentId: bankIds[c.id] || c.paymentId }); }}>
      <h3 className="font-semibold">Сверка платежа · {c.amountMinor / 100} ₽</h3><p className="break-all type-ui">OrderId: {c.id}</p><p>{labels[c.status] || "Требуется сверка"}</p>
      <label className="block">PaymentId из банка<input className="field mt-1" required inputMode="numeric" pattern="[0-9]{1,20}" value={bankIds[c.id] ?? c.paymentId ?? ""} onChange={e => setBankIds({ ...bankIds, [c.id]: e.target.value })} /></label>
      <button className="button-secondary" disabled={busy}>Проверить существующий платёж</button>
    </form>)}
    {rows.map(s => <article className="panel p-5 space-y-3" key={s.id}>
      <h3 className="font-semibold">{s.title}</h3><p className="type-ui break-all">№ {s.id} · клиент {s.userId}</p>
      <p>{s.amountMinor / 100} ₽ / {s.months} мес. · {labels[s.status] || "Требуется сверка"}</p>
      {s.paidUntil && <p>Оплачено до {new Date(s.paidUntil).toLocaleString("ru-RU")}</p>}
      {s.trustUntil && <p>Доверительный срок до {new Date(s.trustUntil).toLocaleString("ru-RU")}. Это не подтверждение оплаты.</p>}
      {s.syncPending && <p role="status">Изменение доступа ожидает передачи в TZ ID.</p>}
      {s.method === "INVOICE" && s.status === "AWAITING_INVOICE" && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void action({ id: s.id, action: "confirmInvoice", reference: references[s.id] }); }}>
        <p>Выставьте счёт и проверьте реальное поступление денег. Это ручная сверка, не подтверждение банка через API.</p>
        <label className="block">Номер банковской операции<input className="field mt-1" required minLength={5} maxLength={200} value={references[s.id] || ""} onChange={e => setReferences({ ...references, [s.id]: e.target.value })} /></label>
        <label className="flex gap-3"><input type="checkbox" required />Подтверждаю поступление всей суммы за этот период</label><button className="button-secondary" disabled={busy}>Сверить оплату и выдать доступ</button>
      </form>}
    </article>)}
  </section>;
}
