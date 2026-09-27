import Link from "next/link";

export default function NotFound() {
  return (
    <main className="site-shell grid min-h-screen place-items-center py-16 text-center">
      <div className="max-w-2xl">
        <p className="eyebrow">404 / Не найдено</p>
        <h1 className="type-h1 mt-5 text-text">Такой страницы нет.</h1>
        <p className="mt-6 type-lead text-muted">Вернитесь на главный экран или сразу отправьте заявку в TRIOZ.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link className="cta-dark" href="/">На главную</Link>
          <a className="button-secondary" href="https://trioz.ru/connect" target="_blank" rel="noopener noreferrer">trioz.ru/connect</a>
        </div>
      </div>
    </main>
  );
}
