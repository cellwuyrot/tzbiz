"use client";
import { renameDisplayText } from "@/lib/display-labels";
import { useCallback, useEffect, useState } from "react";
import { adminFetch, adminMutation } from "@/lib/admin-fetch";
type Client = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  latestLead: {
    phone: string;
    company: string;
    serviceTitle: string;
    message: string;
    createdAt: string;
  } | null;
};
export function AdminClients({ onUpdated }: { onUpdated: () => void }) {
  const [clients, setClients] = useState<Client[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [query, setQuery] = useState(""),
    [q, setQ] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [name, setName] = useState(""),
    [email, setEmail] = useState("");
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const data = await adminFetch<{ clients: Client[]; total: number }>(
          `/api/admin/clients?page=${page}&q=${encodeURIComponent(q)}`,
          { signal },
        );
        if (!signal?.aborted) {
          setClients(data.clients);
          setTotal(data.total);
        }
      } catch (e) {
        if (!signal?.aborted)
          setError(
            e instanceof Error ? e.message : "Не удалось загрузить клиентов.",
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
  async function action(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await adminMutation<{ temporaryPassword?: string }>(
        url,
        method,
        body,
      );
      setNotice(
        data.temporaryPassword
          ? `Пароль: ${data.temporaryPassword}`
          : "Изменения сохранены.",
      );
      await load();
      onUpdated();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Операция не выполнена.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 space-y-6" aria-labelledby="clients-title">
      <h2 id="clients-title" className="type-h2">
        Клиенты
      </h2>
      {error && (
        <p className="panel p-4 text-danger" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <div className="panel p-4" role="status">
          <span>{notice}</span>
          <button
            className="button-secondary ml-3"
            onClick={() => setNotice("")}
          >
            Скрыть
          </button>
        </div>
      )}
      <form
        className="panel p-5 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await action("/api/admin/clients", "POST", { name, email })) {
            setName("");
            setEmail("");
          }
        }}
      >
        <label className="block type-ui">
          Имя
          <input
            className="field mt-2"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block type-ui">
          Email
          <input
            className="field mt-2"
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="button-primary sm:col-span-2"
        >
          Создать клиента
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
          aria-label="Поиск клиентов"
          placeholder="Имя или email"
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
      <p className="type-ui text-muted" role="status">
        {loading ? "Загрузка…" : `Клиентов: ${total}`}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {clients.map((client) => (
          <article className="panel admin-card space-y-4" key={client.id}>
            <label className="block type-ui">
              Имя
              <input
                className="field mt-2"
                maxLength={120}
                value={client.name}
                onChange={(e) =>
                  setClients((prev) =>
                    prev.map((c) =>
                      c.id === client.id ? { ...c, name: e.target.value } : c,
                    ),
                  )
                }
              />
            </label>
            <label className="block type-ui">
              Email
              <input
                className="field mt-2"
                type="email"
                maxLength={254}
                value={client.email}
                onChange={(e) =>
                  setClients((prev) =>
                    prev.map((c) =>
                      c.id === client.id ? { ...c, email: e.target.value } : c,
                    ),
                  )
                }
              />
            </label>
            {client.latestLead ? (
              <>
                <dl className="admin-facts type-ui">
                  <div>
                    <dt>Телефон</dt>
                    <dd>{client.latestLead.phone}</dd>
                  </div>
                  <div>
                    <dt>Компания</dt>
                    <dd>{client.latestLead.company || "—"}</dd>
                  </div>
                  <div>
                    <dt>Последняя услуга</dt>
                    <dd>{renameDisplayText(client.latestLead.serviceTitle)}</dd>
                  </div>
                  <div>
                    <dt>Дата обращения</dt>
                    <dd>
                      {new Date(client.latestLead.createdAt).toLocaleString(
                        "ru-RU",
                      )}
                    </dd>
                  </div>
                </dl>
                <details>
                  <summary className="type-ui text-accent cursor-pointer">
                    Комментарий к последней заявке
                  </summary>
                  <p className="type-body text-muted whitespace-pre-wrap mt-3">
                    {client.latestLead.message}
                  </p>
                </details>
              </>
            ) : (
              <p className="type-ui text-muted">Заявок нет</p>
            )}
            <div className="admin-toolbar">
              <button
                className="button-secondary"
                disabled={busy}
                onClick={() =>
                  void action(`/api/admin/clients/${client.id}`, "PATCH", {
                    name: client.name,
                    email: client.email,
                  })
                }
              >
                Сохранить
              </button>
              <button
                className="button-secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "Сбросить пароль клиента и завершить все его сеансы?",
                    )
                  )
                    void action(
                      `/api/admin/clients/${client.id}/reset-password`,
                      "POST",
                    );
                }}
              >
                Сбросить пароль
              </button>
              <button
                className="button-secondary text-danger"
                disabled={busy}
                onClick={() => {
                  if (confirm("Удалить клиента? Действие необратимо."))
                    void action(`/api/admin/clients/${client.id}`, "DELETE");
                }}
              >
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>
      {!loading && !clients.length && (
        <p className="panel p-5 type-body text-muted">Клиенты не найдены.</p>
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
