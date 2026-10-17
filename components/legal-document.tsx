import Link from "next/link";
import { SiteHeader } from "./site-header";
import { Breadcrumbs } from "./breadcrumbs";
import { legalNotice } from "@/lib/legal-documents";

type Document = {
  published?: boolean;
  publishedAt?: string | null;
  title: string;
  version: string;
  sections: { title: string; paragraphs: string[] }[];
};

export function LegalDocument({ document }: { document: Document }) {
  return (
    <main className="min-h-screen bg-bg text-text">
      <SiteHeader basePath="/" />
      <article className="site-shell py-8 lg:py-12">
        <Breadcrumbs
          items={[{ label: "Главная", href: "/" }, { label: document.title }]}
        />
        <div className="mx-auto mt-10 max-w-4xl">
          <p className="eyebrow">TRIOZ Business / Документы</p>
          <h1 className="type-h2 mt-5 break-words text-2xl leading-tight sm:text-[length:var(--font-size-h2)]">
            {document.title}
          </h1>
          <p className="mt-4 type-ui text-subtle break-all">
            Редакция: {document.version}
          </p>
          {document.published ? (
            <p className="mt-4 type-ui text-muted">
              Опубликованная редакция{" "}
              {document.publishedAt
                ? new Date(document.publishedAt).toLocaleDateString("ru-RU")
                : ""}
            </p>
          ) : (
            <p className="panel mt-6 p-5 type-body text-muted">{legalNotice}</p>
          )}
          <nav
            className="mt-8 grid gap-3 type-ui"
            aria-label="Разделы документа"
          >
            {document.sections.map((section, index) => (
              <a
                key={section.title}
                href={`#section-${index + 1}`}
                className="text-accent underline"
              >
                {section.title}
              </a>
            ))}
          </nav>
          {document.sections.map((section, index) => (
            <section
              key={section.title}
              className="mt-10 scroll-mt-8"
              aria-labelledby={`section-${index + 1}`}
            >
              <h2 id={`section-${index + 1}`} className="type-h3 break-words">
                {section.title}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-4 type-body text-muted">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>
      <footer className="site-shell border-t border-border py-10">
        <nav
          className="flex flex-wrap gap-5 type-ui text-accent"
          aria-label="Документы и контакты"
        >
          <Link href="/">На главную</Link>
          <Link href="/agreement">Соглашение</Link>
          <Link href="/privacy">Политика данных</Link>
          <Link href="/documents/offer">Оферта</Link>
          <Link href="/documents/cookies">Cookie</Link>
          <Link href="/documents/consent">Согласие на обработку данных</Link>
          <a href="mailto:info@trioz.ru">info@trioz.ru</a>
        </nav>
      </footer>
    </main>
  );
}
