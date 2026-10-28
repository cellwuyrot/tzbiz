"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { analyticsPath } from "@/lib/privacy";
type Choice = { chosen: boolean; analytics: boolean; analyticsReady?: boolean };
export function CookieConsent() {
  const pathname = usePathname(),
    [choice, setChoice] = useState<Choice | null>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const viewed = useRef("");
  const load = useCallback(async () => {
    const r = await fetch("/api/privacy/consent", { cache: "no-store" });
    if (!r.ok) throw Error("Не удалось загрузить настройки cookie.");
    const d = await r.json();
    setChoice(d);
    if (!d.chosen) setOpen(true);
  }, []);
  useEffect(() => {
    load().catch((e) => {
      setError(e.message);
      setOpen(true);
    });
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel("trioz-cookie-choice");
      channel.onmessage = () => {
        load().catch(() => {});
      };
    } catch {}
    return () => channel?.close();
  }, [load]);
  useEffect(() => {
    if (
      !choice?.analytics ||
      navigator.doNotTrack === "1" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl
    )
      return;
    const path = analyticsPath(pathname);
    if (!path || viewed.current === path) return;
    viewed.current = path;
    fetch("/api/analytics/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname, choice]);
  async function save(analytics: boolean) {
    setBusy(true);
    setError("");
    try {
      const c = await fetch("/api/auth/csrf", { cache: "no-store" });
      if (!c.ok) throw Error("Не удалось сохранить выбор.");
      const { token } = await c.json();
      const r = await fetch("/api/privacy/consent", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ analytics }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Не удалось сохранить выбор. Повторите попытку.");
      setNotice(d.notice || "");
      if (!d.analytics) viewed.current = "";
      setChoice(d);
      setOpen(false);
      try {
        const channel = new BroadcastChannel("trioz-cookie-choice");
        channel.postMessage("changed");
        channel.close();
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка настроек cookie.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="privacy-controls">
      {notice && <p role="status" className="cookie-notice panel p-4 type-ui">{notice} <button type="button" className="text-accent underline" onClick={() => setNotice("")}>Закрыть</button></p>}
      {open ? (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-title"
          className="cookie-panel panel space-y-4 p-5 sm:p-6"
        >
          <h2 id="cookie-title" className="type-h3">
            Cookie и аналитика
          </h2>
          <p className="type-ui text-muted">
            Необходимые cookie обеспечивают вход и безопасность. Необязательная
            аналитика считает только суммарные просмотры публичных страниц и
            включается с вашего согласия. Отказ не мешает пользоваться сайтом.
          </p>
          <nav className="flex flex-wrap gap-4 type-ui text-accent">
            <Link href="/documents/cookies">Политика cookie</Link>
            <Link href="/privacy">Политика данных</Link>
            <Link href="/documents">Все документы</Link>
          </nav>
          {choice?.chosen && (
            <p className="type-ui text-muted">
              Аналитика: {choice.analytics ? "разрешена" : "отключена"}
            </p>
          )}
          {error && (
            <p role="alert" className="type-ui text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() => save(false)}
            >
              Только необходимые
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() => save(true)}
            >
              Разрешить аналитику
            </button>
            {choice?.chosen && (
              <button
                type="button"
                className="button-secondary"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Закрыть
              </button>
            )}
          </div>
        </section>
      ) : (
        <button
          type="button"
          className="cookie-toggle button-secondary"
          onClick={() => setOpen(true)}
        >
          Cookie
        </button>
      )}
    </div>
  );
}
