import Link from "next/link";
import { RequestServiceLink } from "./request-service-link";
import { ArrowUpRight, LogoMark } from "./icons";
export function SiteHeader({ basePath = "" }: { basePath?: string }) {
  const links = [
    [`${basePath}#services`, "Услуги"],
    ["/plans", "Каталог"],
    ["/documents", "Документы"],
    ["/payment", "Как оплатить"],
    [`${basePath}#contact`, "Контакты"],
    ["/account", "Войти / Кабинет"],
  ];
  return (
    <header className="relative z-30 border-b border-border">
      <div className="site-shell flex min-h-20 flex-wrap items-center justify-between gap-4 py-4">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-3"
          aria-label="TRIOZ — на главную"
        >
          <LogoMark />
          <span className="brand-mark text-text">TRIOZ</span>
        </Link>
        <nav
          className="hidden items-center gap-5 xl:flex"
          aria-label="Основная навигация"
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center type-ui text-muted hover:text-text"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <RequestServiceLink className="hidden min-h-11 items-center gap-2 type-ui font-semibold sm:inline-flex">
            Обсудить задачу <ArrowUpRight />
          </RequestServiceLink>
          <details className="relative xl:hidden">
            <summary
              className="button-secondary cursor-pointer list-none"
              aria-label="Открыть меню"
            >
              Меню
            </summary>
            <nav
              className="absolute right-0 top-full mt-3 grid w-64 gap-1 rounded-xl border border-border bg-panel p-3 shadow-xl"
              aria-label="Мобильная навигация"
            >
              {links.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-lg px-3 py-3 type-ui hover:bg-panel-2"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
