import { MediaImage } from "@/components/media-image";
import Link from "next/link";
import { getClientProjects } from "@/lib/project-access";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProjectMonitor } from "@/components/project-monitor";
import { STATUS_LABELS } from "@/lib/constants";
import { ArrowUpRight, LogoMark } from "@/components/icons";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account");
  if (user.role === "ADMIN") redirect("/admin");
  const projects = await getClientProjects(user.id);

  return (
    <main className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-panel">
        <div className="site-shell flex min-h-20 items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <p className="brand-mark text-text">TRIOZ / BUSINESS</p>
              <p className="type-ui text-subtle">Личный кабинет</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3"><Link className="button-secondary" href="/account">Заказы и оплата</Link><LogoutButton /></div>
        </div>
      </header>

      <section className="site-shell py-12 sm:py-16">
        <div className="mb-10">
          <p className="eyebrow">Dashboard / My projects</p>
          <h1 className="type-h2 mt-3 text-text">Мои проекты</h1>
          <p className="mt-4 max-w-2xl type-lead text-muted">
            {user.name}, здесь собраны проекты, назначенные вашему аккаунту.
          </p>
        </div>

        <nav className="account-tabs mb-8" aria-label="Личный кабинет"><Link href="/account?section=orders">Заказы и оплата</Link><Link href="/account?section=invoices">Счета</Link><Link href="/account?section=profile">Профиль</Link><Link href="/dashboard" aria-current="page">Мои проекты</Link></nav>
        {user.role === "CONSULTANT" ? <ProjectMonitor /> : <p className="panel p-6 type-body text-muted">Мониторинг партнёрских проектов доступен после назначения администратором роли партнёра в TrioZ и закрепления проекта за вашим аккаунтом.</p>}
        <details className="mt-10"><summary className="min-h-12 cursor-pointer type-ui">Материалы и ранее назначенные проекты</summary>
        {projects.length === 0 ? (
          <div className="panel grid min-h-[300px] place-items-center p-8 text-center">
            <div>
              <div
                className="mx-auto mb-5 h-px w-16 bg-accent"
                aria-hidden="true"
              />
              <h2 className="type-h3 text-text">Пока здесь пусто.</h2>
              <p className="mt-3 max-w-md type-body text-muted">
                Как только команда TRIOZ назначит проект вашему аккаунту, он
                появится в этом разделе.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="overflow-hidden rounded-3xl border border-border bg-panel"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-panel-2">
                  <MediaImage
                    src={project.previewPath}
                    alt={`Превью проекта «${project.title}»`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-5">
                  <div className="status-pill">
                    {STATUS_LABELS[project.status]}
                  </div>
                  <h2 className="mt-4 type-h3 text-text">{project.title}</h2>
                  <p className="mt-3 type-body text-muted">
                    {project.description}
                  </p>
                  <a
                    className="mt-5 inline-flex min-h-12 items-center gap-2 type-ui font-semibold text-accent"
                    href={project.projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Открыть проект <ArrowUpRight />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
        </details>
      </section>
    </main>
  );
}
