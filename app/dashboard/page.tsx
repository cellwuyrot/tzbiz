import { getClientProjects } from "@/lib/project-access";
import { requireRole } from "@/lib/auth";
import { STATUS_LABELS } from "@/lib/constants";
import { ArrowUpRight, LogoMark } from "@/components/icons";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireRole("CLIENT");
  const projects = await getClientProjects(user.id);

  return (
    <main className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-panel">
        <div className="site-shell flex min-h-20 items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <p className="brand-mark text-text">TRIOZ / CLIENT</p>
              <p className="type-ui text-subtle">Личный кабинет</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className="site-shell py-12 sm:py-16">
        <div className="mb-10">
          <p className="eyebrow">Dashboard / My projects</p>
          <h1 className="type-h2 mt-3 text-text">Мои проекты</h1>
          <p className="mt-4 max-w-2xl type-lead text-muted">{user.name}, здесь собраны проекты, назначенные вашему аккаунту.</p>
        </div>

        {projects.length === 0 ? (
          <div className="panel grid min-h-[300px] place-items-center p-8 text-center">
            <div>
              <div className="mx-auto mb-5 h-px w-16 bg-accent" aria-hidden="true" />
              <h2 className="type-h3 text-text">Пока здесь пусто.</h2>
              <p className="mt-3 max-w-md type-body text-muted">Как только команда TRIOZ назначит проект вашему аккаунту, он появится в этом разделе.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <article key={project.id} className="overflow-hidden rounded-3xl border border-border bg-panel">
                <div className="relative aspect-[16/10] overflow-hidden bg-panel-2">
                  <img src={project.previewPath} alt={`Превью проекта «${project.title}»`} className="h-full w-full object-cover" />
                </div>
                <div className="p-5">
                  <div className="status-pill">{STATUS_LABELS[project.status]}</div>
                  <h2 className="mt-4 type-h3 text-text">{project.title}</h2>
                  <p className="mt-3 type-body text-muted">{project.description}</p>
                  <a className="mt-5 inline-flex min-h-12 items-center gap-2 type-ui font-semibold text-accent" href={project.projectUrl} target="_blank" rel="noopener noreferrer">
                    Открыть проект <ArrowUpRight />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
