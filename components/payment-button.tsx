"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function PaymentButton({ orderId, checkOnly = false }: { orderId: string; checkOnly?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function run(check: boolean) {
    setBusy(true); setError("");
    try {
      const c = await fetch("/api/auth/csrf", { cache: "no-store" });
      if (!c.ok) throw Error("Не удалось подготовить запрос. Обновите страницу.");
      const { token } = await c.json();
      const response = await fetch(`/api/orders/${orderId}/${check ? "payment" : "pay"}`, { method: "POST", headers: { "x-csrf-token": token } });
      const d = await response.json();
      if (!response.ok) throw Error(d.error || "Не удалось выполнить запрос.");
      if (d.paymentUrl) { window.location.assign(d.paymentUrl); return; }
      if (d.status === "CREATING") setError("Банк ещё обрабатывает запрос. Если статус не меняется, обратитесь в поддержку — повторять оплату не нужно.");
      router.refresh();
    } catch(e) { setError(e instanceof Error ? e.message : "Ошибка оплаты."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3"><div className="flex flex-wrap gap-3">{!checkOnly && <button type="button" disabled={busy} className="button-primary" onClick={() => run(false)}>{busy ? "Подождите…" : "Оплатить через Т-Банк"}</button>}<button type="button" disabled={busy} className="button-secondary" onClick={() => run(true)}>Проверить оплату</button></div>{error && <p role="alert" className="type-ui text-danger">{error}</p>}</div>;
}
