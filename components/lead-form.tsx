"use client";

import { useMemo, useState } from "react";
import type { ServiceView } from "@/lib/service-content";
import { ArrowUpRight } from "./icons";

export function LeadForm({ services, initialServiceSlug }: { services: ServiceView[]; initialServiceSlug?: string }) {
  const firstSlug = useMemo(() => initialServiceSlug && services.some((service) => service.slug === initialServiceSlug) ? initialServiceSlug : services[0]?.slug ?? "", [initialServiceSlug, services]);
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    serviceSlug: firstSlug,
    message: "",
    privacyConsent: false,
    website: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(name: keyof typeof values, value: string | boolean) {
    setValues((previous) => ({ ...previous, [name]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSubmitted(false);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось отправить заявку.");
      setSubmitted(true);
      setValues((previous) => ({ ...previous, name: "", email: "", phone: "", company: "", message: "", privacyConsent: false, website: "" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отправить заявку.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="lead-form panel" aria-describedby="lead-form-note">
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label htmlFor="lead-name" className="mb-2 block type-ui font-semibold text-text">Имя *</label>
          <input id="lead-name" className="field" name="name" autoComplete="name" required maxLength={120} value={values.name} onChange={(event) => update("name", event.target.value)} />
        </div>
        <div>
          <label htmlFor="lead-email" className="mb-2 block type-ui font-semibold text-text">Email *</label>
          <input id="lead-email" className="field" name="email" autoComplete="email" type="email" required maxLength={254} value={values.email} onChange={(event) => update("email", event.target.value)} />
        </div>
        <div>
          <label htmlFor="lead-phone" className="mb-2 block type-ui font-semibold text-text">Телефон *</label>
          <input id="lead-phone" className="field" name="tel" autoComplete="tel" required maxLength={40} value={values.phone} onChange={(event) => update("phone", event.target.value)} />
        </div>
        <div>
          <label htmlFor="lead-company" className="mb-2 block type-ui font-semibold text-text">Компания</label>
          <input id="lead-company" className="field" name="organization" autoComplete="organization" maxLength={160} value={values.company} onChange={(event) => update("company", event.target.value)} />
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="lead-service" className="mb-2 block type-ui font-semibold text-text">Услуга *</label>
          <select id="lead-service" className="field" required value={values.serviceSlug} onChange={(event) => update("serviceSlug", event.target.value)}>
            {services.map((service) => <option key={service.slug} value={service.slug}>{service.title}</option>)}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="lead-message" className="mb-2 block type-ui font-semibold text-text">Особенности проекта и комментарии *</label>
          <textarea id="lead-message" className="field min-h-36 resize-y" name="message" required minLength={10} maxLength={5000} placeholder="Что нужно сделать, какие есть ограничения, интеграции, сроки или особые требования?" value={values.message} onChange={(event) => update("message", event.target.value)} />
        </div>
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="lead-website">Website</label>
          <input id="lead-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(event) => update("website", event.target.value)} />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <label className="flex max-w-2xl gap-3 type-ui text-muted">
          <input className="mt-1 h-5 w-5 shrink-0 accent-accent" type="checkbox" checked={values.privacyConsent} required onChange={(event) => update("privacyConsent", event.target.checked)} />
          <span id="lead-form-note">Соглашаюсь на обработку данных, указанных в заявке, для связи по вопросу обращения.</span>
        </label>
        <button className="cta-dark shrink-0" type="submit" disabled={loading}>
          {loading ? "Отправляем…" : "Отправить заявку"} <ArrowUpRight />
        </button>
      </div>

      {submitted ? <p className="mt-4 type-body text-success" role="status">Заявка отправлена. Мы свяжемся с вами по указанным контактам.</p> : null}
      {error ? <p className="mt-4 type-body text-danger" role="alert">{error}</p> : null}
    </form>
  );
}
