"use client";
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="site-shell space-y-5 py-12">
      <h1 className="type-h2">Не удалось открыть админ-панель</h1>
      <p className="type-body">
        Сервер не загрузил данные. Проверьте доступность базы и применение
        миграций. {error.digest ? `Код обращения: ${error.digest}` : ""}
      </p>
      <div className="admin-toolbar">
        <button className="button-primary" onClick={reset}>
          Повторить
        </button>
        <a className="button-secondary" href="/account">
          Войти снова
        </a>
      </div>
    </main>
  );
}
