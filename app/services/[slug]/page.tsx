import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceBySlug, getPublishedServices } from "@/lib/service-content";
import { ArrowUpRight, ChevronRight } from "@/components/icons";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const services = await getPublishedServices();
  const service = getServiceBySlug(services, slug);
  if (!service) return { title: "TRIOZ — услуга" };
  return {
    title: service.title,
    description: service.shortDescription,
    alternates: { canonical: `/services/${service.slug}` },
    openGraph: { title: `${service.title} — TRIOZ`, description: service.shortDescription, type: "website", url: `https://trioz.ru/services/${service.slug}` },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const services = await getPublishedServices();
  const service = getServiceBySlug(services, slug);
  if (!service) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: service.title,
        description: service.shortDescription,
        url: `https://trioz.ru/services/${service.slug}`,
        provider: { "@id": "https://trioz.ru/#organization" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Главная", item: "https://trioz.ru/" },
          { "@type": "ListItem", position: 2, name: "Услуги", item: "https://trioz.ru/#services" },
          { "@type": "ListItem", position: 3, name: service.title, item: `https://trioz.ru/services/${service.slug}` },
        ],
      },
    ],
  };

  return (
    <main className="min-h-screen bg-bg text-text">
      <SiteHeader basePath="/" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="site-shell py-8 lg:py-12">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Услуги", href: "/#services" }, { label: service.title }]} />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <article>
            <p className="eyebrow">Услуга TRIOZ</p>
            <h1 className="type-h1 mt-5 max-w-5xl text-text">{service.title}</h1>
            <p className="mt-8 max-w-3xl type-lead text-muted">{service.fullDescription}</p>
            <section className="mt-12" aria-labelledby="service-includes-title">
              <h2 id="service-includes-title" className="type-h2 text-text">Что входит</h2>
              <ul className="mt-7 grid gap-3">
                {service.includes.map((item, index) => <li key={item} className="panel flex gap-4 p-5 type-body text-muted"><span className="type-ui text-accent">{String(index + 1).padStart(2, "0")}</span><span>{item}</span></li>)}
              </ul>
            </section>
            <section className="mt-12" aria-labelledby="service-stages-title">
              <h2 id="service-stages-title" className="type-h2 text-text">Этапы работы</h2>
              <ol className="mt-7 grid gap-3">
                {service.stages.map((item, index) => <li key={item} className="process-row"><span className="type-ui text-accent">{String(index + 1).padStart(2, "0")}</span><span className="type-body text-muted">{item.replace(/^Этап\s+\d+\.\s*/, "")}</span></li>)}
              </ol>
            </section>
          </article>
          <aside className="lg:sticky lg:top-8 self-start">
            {service.media[0] ? (
              <div className="gallery-stage">
                {service.media[0].type === "VIDEO" ? <video controls preload="metadata" src={service.media[0].path} aria-label={`Видео услуги ${service.title}`} /> : <img src={service.media[0].path} alt={`Иллюстрация услуги «${service.title}»`} />}
              </div>
            ) : (
              <div className="panel min-h-72 p-8 type-body text-muted">Галерея услуги будет добавлена через админ-панель.</div>
            )}
            <div className="mt-5 panel p-6">
              <p className="type-body text-muted">Готовы обсудить задачу по этой услуге?</p>
              <a className="cta-dark mt-5 w-full" href={`https://trioz.ru/connect?service=${encodeURIComponent(service.slug)}`} target="_blank" rel="noopener noreferrer">Оставить заявку <ArrowUpRight /></a>
            </div>
          </aside>
        </div>
        <div className="mt-14 flex flex-wrap gap-3">
          <Link className="button-secondary" href="/#services"><ChevronRight /> Все услуги</Link>
          <Link className="button-secondary" href="/">На главную</Link>
        </div>
      </div>
      <footer className="site-shell border-t border-border py-10 text-subtle">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between type-ui">
          <span>TRIOZ Digital systems</span>
          <a href="https://trioz.ru/connect" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-text">Основной проект: trioz.ru/connect</a>
        </div>
      </footer>
    </main>
  );
}
