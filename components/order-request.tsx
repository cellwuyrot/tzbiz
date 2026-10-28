"use client";
import { PaymentButton } from "./payment-button";
import { useLegalConsent } from "@/lib/use-legal-consent";
import { useEffect, useState } from "react";
export function OrderRequest({
  planId,
  revision,
  payable = false,
}: {
  planId: string;
  revision: number;
  payable?: boolean;
}) {
  const legal = useLegalConsent();
  const [offer, setOffer] = useState(false);
  const [message, setMessage] = useState(""),
    [accepted, setAccepted] = useState(false),
    [privacy, setPrivacy] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [id, setId] = useState(""),
    [key, setKey] = useState("");
  const draftKey = `trioz:order:${planId}:${revision}`;
  useEffect(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      if (d && Date.now() - d.at < 1_800_000) {
        setMessage(d.message || "");
        setKey(d.key || "");
      }
    } catch {
      /* Storage may be unavailable. */
    }
  }, [draftKey]);
  function persist(text: string, k: string) {
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ message: text, key: k, at: Date.now() }),
      );
    } catch {
      /* Continue without draft storage. */
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const requestKey = key || crypto.randomUUID();
    setKey(requestKey);
    persist(message, requestKey);
    try {
      const c = await fetch("/api/auth/csrf");
      if (!c.ok) throw Error("Не удалось подготовить отправку.");
      const { token } = await c.json();
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({
          legalVersions: legal.versions,
          offerAccepted: offer,
          planId,
          revision,
          requestKey,
          message,
          agreementAccepted: accepted,
          privacyConsent: privacy,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось отправить.");
      setId(d.id);
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки.");
    } finally {
      setBusy(false);
    }
  }
  if (id)
    return (
      <div className="panel space-y-4 p-6" role="status">
        <h2 className="type-h3">{payable ? "Заказ оформлен" : "Заявка сохранена"}</h2>
        <p className="type-body break-all">Номер: {id}</p>
        <p className="type-body text-muted">
          Условия заказа сохранены. Оплата ещё не проведена.
          {payable ? " Перейдите на защищённую страницу банка для оплаты." : " Следите за согласованием в кабинете."}
        </p>
        {payable && <PaymentButton orderId={id} />}
        <a href="/account?section=orders" className="button-primary">
          Перейти в кабинет
        </a>
      </div>
    );
  return (
    <form onSubmit={submit} className="panel space-y-5 p-6">
      <h2 className="type-h3">Оформление заказа</h2>
      <p className="type-body text-muted">
        {payable ? "Сохраните заказ, затем оплатите его на странице Т-Банка. Это разовый платёж, без автосписаний." : "Отправьте заявку для согласования стоимости и сроков. Оплата на этом шаге не проводится."}
      </p>
      <label className="block type-ui">
        Комментарий к заказу или описание задачи
        <textarea
          className="field mt-2 min-h-32"
          required
          minLength={10}
          maxLength={5000}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (!busy) setKey("");
            persist(e.target.value, "");
          }}
        />
      </label>
      <label className="flex gap-3 type-ui">
        <input
          type="checkbox"
          required
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        <span>
          Принимаю{" "}
          <a
            className="text-accent underline"
            href={legal.href("agreement")}
            target="_blank"
            rel="noopener noreferrer"
          >
            соглашение
          </a>{" "}
          и ознакомлен с условиями предложения.
        </span>
      </label>
      <label className="flex gap-3 type-ui">
        <input
          type="checkbox"
          required
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
        />
        <span>
          Даю согласие на обработку данных для рассмотрения заявки согласно{" "}
          <a
            className="text-accent underline"
            href={legal.href("privacy")}
            target="_blank"
            rel="noopener noreferrer"
          >
            политике
          </a>{" "}
          и{" "}
          <a
            className="text-accent underline"
            href={legal.href("consent")}
            target="_blank"
            rel="noopener noreferrer"
          >
            отдельному согласию
          </a>
          .
        </span>
      </label>
      <label className="flex gap-3 type-ui">
        <input
          type="checkbox"
          required
          checked={offer}
          onChange={(e) => setOffer(e.target.checked)}
        />
        <span>
          Ознакомлен с{" "}
          <a
            className="text-accent underline"
            href={legal.href("offer")}
            target="_blank"
            rel="noopener noreferrer"
          >
            офертой
          </a>{" "}
          и условиями выбранной карточки. Заявка не является согласием на
          автосписания.
        </span>
      </label>
      {legal.error && (
        <p role="alert" className="text-danger type-ui">
          {legal.error}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger type-body">
          {error}
        </p>
      )}
      <button
        className="button-primary"
        disabled={busy || !legal.ready}
        type="submit"
      >
        {busy ? "Сохраняем…" : payable ? "Оформить заказ" : "Отправить заявку"}
      </button>
    </form>
  );
}
