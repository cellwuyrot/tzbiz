import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getPublishedServices, getServiceBySlug } from "@/lib/service-content";
import { getSiteSettingsOrDefaults } from "@/lib/site-settings";
import { ArrowUpRight, ChevronRight, LogoMark } from "@/components/icons";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { LeadForm } from "@/components/lead-form";
import { LivingSystem } from "@/components/living-system";
import { PortfolioSection } from "@/components/portfolio-section";
import { ScrollReveal } from "@/components/scroll-reveal";
import { ServiceCatalog } from "@/components/service-catalog";
import { ServiceDock } from "@/components/service-dock";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettingsOrDefaults();
  return {
    title: `TRIOZ — ${settings.tagline}`,
    description: settings.heroSubtitle,
    alternates: { canonical: "/" },
    openGraph: {
      title: `TRIOZ — ${settings.tagline}`,
      description: settings.heroSubtitle,
      url: "https://trioz.ru/",
      type: "website",
    },
  };
}

const steps = [
  ["01", "Слушаем задачу", "Разбираемся, как устроен процесс сегодня и где бизнес теряет время, данные или контроль."],
  ["02", "Собираем решение", "Выбираем только нужные инструменты и проектируем связку без лишнего технологического слоя."],
  ["03", "Проверяем на реальном сценарии", "Настраиваем, разрабатываем и тестируем на тех действиях, которыми пользуется команда."],
  ["04", "Передаём в работу", "Документируем результат, обучаем сотрудников и оставляем понятную точку входа для поддержки."],
  ["05", "Развиваем дальше", "Когда процесс меняется, решение можно доработать без сборки всего с нуля."],
] as const;

async function getPublicProjects() {
  return prisma.project.findMany({
    where: { isPublic: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, title: true, projectUrl: true, previewPath: true },
  });
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string | string[] }>;
}) {
  const [services, settings, projects] = await Promise.all([
    getPublishedServices(),
    getSiteSettingsOrDefaults(),
    getPublicProjects(),
  ]);

  const serviceParam = (await searchParams).service;
  const serviceSlug = Array.isArray(serviceParam) ? serviceParam[0] : serviceParam;
  const selectedService = getServiceBySlug(services, serviceSlug);

  return (
    <main className="min-h-screen bg-bg text-text">
      <ServiceDock services={services} />
      <SiteHeader />

      <section className="hero site-shell pl-5 lg:pl-24" aria-labelledby="hero-title">
        <div className="hero__grid" aria-hidden="true" />
        <div className="pt-4 lg:pt-6"><Breadcrumbs items={[{ label: "Главная" }]} /></div>
        <div className="grid min-h-[calc(100vh-5rem)] gap-10 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-16">
          <div className="relative z-10 max-w-3xl">
            <ScrollReveal>
              <div className="eyebrow">{settings.tagline}</div>
              <h1 id="hero-title" className="type-h1 mt-5 max-w-3xl text-text">
                {settings.heroTitle}
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <p className="mt-7 max-w-2xl type-lead text-muted">{settings.heroSubtitle}</p>
            </ScrollReveal>

            <ScrollReveal delay={180}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a className="cta-dark" href="https://trioz.ru/connect" target="_blank" rel="noopener noreferrer">
                  Обсудить задачу <ArrowUpRight />
                </a>
                <a className="inline-flex min-h-12 items-center gap-2 type-ui font-semibold text-muted transition-colors hover:text-text" href="#services">
                  Посмотреть направления <ChevronRight />
                </a>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={240}>
              <div className="hero__meta mt-14">
                <div><strong>{services.length}</strong><span>направлений</span></div>
                <div><strong>01</strong><span>команда на связи</span></div>
                <div><strong>∞</strong><span>точек развития</span></div>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={120} className="relative z-10 lg:-mr-10">
            <LivingSystem />
          </ScrollReveal>
        </div>
      </section>

      <section id="services" className="site-shell scroll-mt-10 pl-5 pb-28 pt-20 lg:pl-24 lg:pb-36 lg:pt-28" aria-labelledby="services-title">
        <div className="grid gap-8 lg:grid-cols-[0.55fr_1.45fr]">
          <ScrollReveal>
            <p className="eyebrow">Capabilities / {services.length}</p>
            <h2 id="services-title" className="type-h2 max-w-sm text-text">Рабочие направления команды.</h2>
            <p className="mt-5 max-w-sm type-lead text-muted">Каждая услуга начинается с разбора контекста: процессов, данных, доступов и ожидаемого результата. После этого мы определяем реальный объём работ.</p>
          </ScrollReveal>

          <ServiceCatalog services={services} initialSlug={selectedService?.slug} />
        </div>
      </section>

      <PortfolioSection projects={projects} />

      <section id="process" className="process-section" aria-labelledby="process-title">
        <div className="site-shell pl-5 lg:pl-24">
          <div className="grid gap-12 lg:grid-cols-[0.65fr_1.35fr]">
            <ScrollReveal>
              <p className="eyebrow">Method / 05</p>
              <h2 id="process-title" className="type-h2 max-w-md text-text">Работаем так, чтобы результат можно было продолжать.</h2>
              <p className="mt-5 max-w-md type-lead text-muted">Во всех услугах логика одна: заявка → погружение → согласованный план → работа → проверка → понятная передача.</p>
            </ScrollReveal>

            <div>
              {steps.map(([number, title, text], index) => (
                <ScrollReveal key={number} delay={index * 70}>
                  <div className="process-row">
                    <span className="type-ui text-subtle">{number}</span>
                    <div>
                      <h3 className="type-h3 text-text">{title}</h3>
                      <p className="mt-2 max-w-2xl type-body text-muted">{text}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="site-shell scroll-mt-10 py-24 lg:py-32" aria-labelledby="contact-title">
        <div className="grid gap-8 lg:grid-cols-[0.65fr_1.35fr] lg:items-start">
          <ScrollReveal>
            <p className="eyebrow">Contact / Заявка</p>
            <h2 id="contact-title" className="type-h2 max-w-md text-text">Давайте обсудим ваш проект.</h2>
            <p className="mt-5 max-w-md type-lead text-muted">Опишите задачу и особенности проекта. Заявка сохранится в админ-панели, а уведомление придёт на info@trioz.ru.</p>
          </ScrollReveal>
          <ScrollReveal delay={80}>
            <LeadForm services={services} initialServiceSlug={serviceSlug} />
          </ScrollReveal>
        </div>
      </section>

      <footer className="site-shell py-10 pl-5 lg:pl-24 lg:py-14">
        <div className="footer-line grid gap-10 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3"><LogoMark /><div className="brand-mark text-text">TRIOZ</div></div>
            <p className="mt-4 max-w-xl type-body text-muted">Digital systems для бизнеса: интеграции, автоматизация, веб-разработка, инфраструктура и сопровождение.</p>
            <p className="mt-3 type-ui text-subtle">{settings.contacts}</p>
          </div>
          <div>
            <div className="type-ui font-semibold text-text">Навигация</div>
            <div className="mt-4 grid gap-2 type-ui text-muted">
              <a href="#services" className="hover:text-text">Услуги</a>
              <a href="#portfolio" className="hover:text-text">Проекты</a>
              <a href="#process" className="hover:text-text">Как работаем</a>
              <a href="#contact" className="hover:text-text">Оставить заявку</a>
            </div>
          </div>
          <div>
            <div className="type-ui font-semibold text-text">Контакты</div>
            <div className="mt-4 grid gap-2 type-ui text-muted">
              <a href="mailto:info@trioz.ru" className="hover:text-accent">info@trioz.ru</a>
              <a href="https://trioz.ru/connect" target="_blank" rel="noopener noreferrer" className="hover:text-accent">trioz.ru/connect <ArrowUpRight /></a>
            </div>
          </div>
          <div>
            <div className="type-ui font-semibold text-text">Услуги</div>
            <div className="mt-4 grid gap-2 type-ui text-muted">
              {services.slice(0, 3).map((service) => (
                <a key={service.slug} href={`/services/${service.slug}`} className="hover:text-text">{service.title}</a>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5 type-ui text-subtle sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} TRIOZ. Все права защищены.</span>
          <a href="https://trioz.ru/connect" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-text">Основной проект: trioz.ru/connect <ArrowUpRight /></a>
        </div>
      </footer>
    </main>
  );
}
