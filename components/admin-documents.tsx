"use client";
import { useCallback, useEffect, useState } from "react";
import { adminFetch, adminMutation } from "@/lib/admin-fetch";
type Doc = {
  slug: string;
  title: string;
  body: string;
  revision: number;
  publishedVersion: string | null;
};
type History = {
  slug: string;
  version: string;
  publishedAt: string;
  digest: string;
};
export function AdminDocuments() {
  const [docs, setDocs] = useState<Doc[]>([]),
    [history, setHistory] = useState<History[]>([]),
    [form, setForm] = useState<Doc | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const d = await adminFetch<{ documents: Doc[]; history: History[] }>(
      "/api/admin/documents",
    );
    setDocs(d.documents);
    setHistory(d.history);
    return d.documents;
  }, []);
  useEffect(() => {
    load()
      .then((d) => setForm(d[0]))
      .catch((e) => setError(e.message));
  }, [load]);
  async function save(publish: boolean) {
    if (!form) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await adminMutation("/api/admin/documents", "PUT", {
        ...form,
        publish,
        ownerConfirmed: confirmed,
      });
      const d = await load();
      setForm(d.find((x) => x.slug === form.slug) || null);
      setConfirmed(false);
      setNotice(
        publish
          ? "Редакция опубликована. Предыдущие публикации сохранены."
          : "Черновик сохранён. Публичный документ не изменился.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 space-y-6">
      <h2 className="type-h2">Документы</h2>
      {error && (
        <p role="alert" className="panel p-5 text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="panel p-5 text-success">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {docs.map((d) => (
          <button
            type="button"
            disabled={busy}
            key={d.slug}
            className={
              form?.slug === d.slug ? "button-primary" : "button-secondary"
            }
            onClick={() => {
              if (
                form &&
                (form.body !== docs.find((x) => x.slug === form.slug)?.body ||
                  form.title !==
                    docs.find((x) => x.slug === form.slug)?.title) &&
                !confirm("Отменить несохранённые изменения?")
              )
                return;
              setForm(d);
              setConfirmed(false);
              setNotice("");
            }}
          >
            {d.title}
          </button>
        ))}
      </div>
      {form && (
        <form
          className="panel space-y-5 p-5 sm:p-8"
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
        >
          <p className="type-ui text-muted">
            Черновик: {form.revision} ·{" "}
            {form.publishedVersion
              ? "Есть опубликованная редакция"
              : "Не опубликован"}
          </p>
          <label className="block type-ui">
            Название
            <input
              className="field mt-2"
              required
              minLength={3}
              maxLength={200}
              value={form.title}
              onChange={(e) => {
                setForm({ ...form, title: e.target.value });
                setConfirmed(false);
              }}
            />
          </label>
          <label className="block type-ui">
            Текст документа · заголовки начинаются с #
            <textarea
              className="field mt-2 min-h-[28rem]"
              required
              minLength={100}
              maxLength={100000}
              value={form.body}
              onChange={(e) => {
                setForm({ ...form, body: e.target.value });
                setConfirmed(false);
              }}
            />
          </label>
          <label className="flex items-start gap-3 type-ui">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              Владелец проверил юридические условия, данные оператора и сроки
              хранения; разрешаю публикацию этой редакции. Шаблон не заменяет
              юридическую проверку.
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button className="button-secondary" disabled={busy}>
              Сохранить черновик
            </button>
            <button
              type="button"
              className="button-primary"
              disabled={busy || !confirmed || form.body.trim().length < 100}
              onClick={() => save(true)}
            >
              Опубликовать редакцию
            </button>
            <a
              className="button-secondary"
              href={
                form.slug === "agreement" || form.slug === "privacy"
                  ? `/${form.slug}`
                  : `/documents/${form.slug}`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              Публичная страница ↗
            </a>
          </div>
        </form>
      )}
      <h3 className="type-h3">История публикаций</h3>
      <div className="space-y-3">
        {history
          .filter((h) => h.slug === form?.slug)
          .map((h) => (
            <a
              className="panel block p-4 type-ui break-all text-accent"
              key={h.version}
              href={`/documents/${h.slug}?version=${h.version}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {new Date(h.publishedAt).toLocaleString("ru-RU")} · {h.version}
            </a>
          ))}
      </div>
    </section>
  );
}
