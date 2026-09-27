import Link from "next/link";
import { ArrowUpRight, LogoMark } from "./icons";

export function SiteHeader({ basePath = "" }: { basePath?: string }) {
  const servicesHref = `${basePath}#services`;
  const projectsHref = `${basePath}#portfolio`;
  const processHref = `${basePath}#process`;
  const contactHref = basePath ? "https://trioz.ru/connect" : "#contact";

  return (
    <header className="relative z-30">
      <div className="site-shell flex min-h-20 items-center justify-between gap-5 py-3">
        <Link href="/" className="group inline-flex items-center gap-3" aria-label="TRIOZ — на главную">
          <LogoMark />
          <div>
            <span className="brand-mark text-text">TRIOZ</span>
            <span className="ml-3 hidden type-ui text-subtle sm:inline">Digital systems</span>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Основная навигация">
          <a href={servicesHref} className="type-ui text-muted hover:text-text">Услуги</a>
          <a href={projectsHref} className="type-ui text-muted hover:text-text">Проекты</a>
          <a href={processHref} className="type-ui text-muted hover:text-text">О компании</a>
          <a href={contactHref} className="type-ui text-muted hover:text-text">Контакты</a>
        </nav>
        <a
          href={contactHref}
          {...(basePath ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="group inline-flex items-center gap-2 border-b border-border pb-1 type-ui font-semibold text-text transition-colors hover:border-accent"
        >
          Оставить заявку <ArrowUpRight />
        </a>
      </div>
    </header>
  );
}
