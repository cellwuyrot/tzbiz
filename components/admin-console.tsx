"use client";
import { readAdminResponse } from "@/lib/admin-fetch";
import { AdminDocuments } from "./admin-documents";
import { AdminAnalytics } from "./admin-analytics";
import { AdminInvoices } from "./admin-invoices";
import { AdminClients } from "./admin-clients";
import { useRouter } from "next/navigation";
import { AdminCommerce } from "./admin-commerce";

import { useMemo, useState } from "react";
import { PROJECT_STATUSES, STATUS_LABELS } from "@/lib/constants";
import type { ServiceView } from "@/lib/service-content";
import { LogoMark, ArrowUpRight } from "./icons";
import { LogoutButton } from "./logout-button";
import { AdminBillingPlans } from "./admin-billing-plans";
import { AdminIntegrations } from "./admin-integrations";
import { LeadAdminTable, type Lead } from "./lead-admin-table";

type Client = { id: string; name: string; email: string; createdAt: string };
type Project = {
  id: string;
  title: string;
  description: string;
  previewPath: string;
  projectUrl: string;
  status: (typeof PROJECT_STATUSES)[number];
  isPublic: boolean;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; email: string } | null;
};
type SiteSettings = {
  id: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  contacts: string;
};

async function csrfToken() {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("Не удалось получить CSRF-токен.");
  const data = await response.json();
  return String(data.token ?? "");
}

async function readError(response: Response) {
  try {
    await readAdminResponse(response);
    return "Операция не выполнена.";
  } catch (e) {
    return e instanceof Error ? e.message : "Операция не выполнена.";
  }
}

function linesToList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToLines(value: string[]) {
  return value.join("\n");
}

const blankService = {
  slug: "",
  title: "",
  shortDescription: "",
  fullDescription: "",
  includes: "",
  stages: "",
  sortOrder: "10",
  isPublished: true,
};

export function AdminConsole({
  initialClients,
  initialProjects,
  initialServices,
  initialLeads,
  initialSettings,
}: {
  initialClients: Client[];
  initialProjects: Project[];
  initialServices: ServiceView[];
  initialLeads: Lead[];
  initialSettings: SiteSettings;
}) {
  const router = useRouter();
  const clients = initialClients;
  const [projects, setProjects] = useState(initialProjects);
  const [services, setServices] = useState(initialServices);
  const [settings, setSettings] = useState(initialSettings);
  const [leads, setLeads] = useState(initialLeads);
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<
    | "services"
    | "projects"
    | "leads"
    | "clients"
    | "settings"
    | "integrations"
    | "billing"
    | "commerce"
    | "documents"
    | "analytics"
    | "invoices"
  >("services");

  const [serviceForm, setServiceForm] = useState(blankService);
  const [serviceFiles, setServiceFiles] = useState<File[]>([]);
  const [savingService, setSavingService] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const filteredProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          (clientFilter === "all" || project.clientId === clientFilter) &&
          (statusFilter === "all" || project.status === statusFilter),
      ),
    [projects, clientFilter, statusFilter],
  );

  function resetMessages() {
    setNotice("");
    setError("");
  }

  async function deleteProject(id: string) {
    if (!window.confirm("Удалить проект и его превью?")) return;
    resetMessages();
    try {
      const response = await fetch(`/api/admin/projects/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": await csrfToken() },
      });
      if (!response.ok) throw new Error(await readError(response));
      setProjects((prev) => prev.filter((project) => project.id !== id));
      setNotice("Проект удалён.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось удалить проект.",
      );
    }
  }

  async function createService(event: React.FormEvent) {
    event.preventDefault();
    resetMessages();
    setSavingService(true);
    try {
      const form = new FormData();
      Object.entries(serviceForm).forEach(([key, value]) =>
        form.append(
          key,
          key === "includes" || key === "stages"
            ? JSON.stringify(linesToList(String(value)))
            : String(value),
        ),
      );
      serviceFiles.forEach((file) => form.append("media", file));
      const response = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "x-csrf-token": await csrfToken() },
        body: form,
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      setServices((prev) =>
        [...prev, data.service].sort((a, b) => a.sortOrder - b.sortOrder),
      );
      setServiceForm(blankService);
      setServiceFiles([]);
      setNotice("Услуга создана.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось создать услугу.",
      );
    } finally {
      setSavingService(false);
    }
  }

  async function updateService(next: ServiceView, files: File[]) {
    resetMessages();
    const form = new FormData();
    form.append("slug", next.slug);
    form.append("title", next.title);
    form.append("shortDescription", next.shortDescription);
    form.append("fullDescription", next.fullDescription);
    form.append("includes", JSON.stringify(next.includes));
    form.append("stages", JSON.stringify(next.stages));
    form.append("sortOrder", String(next.sortOrder));
    form.append("isPublished", String(next.isPublished));
    files.forEach((file) => form.append("media", file));

    try {
      const response = await fetch(`/api/admin/services/${next.id}`, {
        method: "PATCH",
        headers: { "x-csrf-token": await csrfToken() },
        body: form,
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      setServices((prev) =>
        prev
          .map((item) => (item.id === data.service.id ? data.service : item))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
      setNotice("Услуга обновлена.");
      return data.service as ServiceView;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось обновить услугу.",
      );
      return null;
    }
  }

  async function deleteService(id: string) {
    if (!window.confirm("Удалить услугу и все её медиа?")) return;
    resetMessages();
    try {
      const response = await fetch(`/api/admin/services/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": await csrfToken() },
      });
      if (!response.ok) throw new Error(await readError(response));
      setServices((prev) => prev.filter((service) => service.id !== id));
      setNotice("Услуга удалена.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось удалить услугу.",
      );
    }
  }

  async function updateMediaOrder(
    serviceId: string,
    mediaId: string,
    sortOrder: number,
  ) {
    resetMessages();
    try {
      const response = await fetch(
        `/api/admin/services/${serviceId}/media/${mediaId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": await csrfToken(),
          },
          body: JSON.stringify({ sortOrder }),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      const service = services.find((item) => item.id === serviceId);
      if (!service) return;
      const media = service.media
        .map((item) => (item.id === mediaId ? { ...item, sortOrder } : item))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      setServices((prev) =>
        prev.map((item) => (item.id === serviceId ? { ...item, media } : item)),
      );
      setNotice("Порядок медиа обновлён.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось изменить порядок медиа.",
      );
    }
  }

  async function deleteMedia(serviceId: string, mediaId: string) {
    resetMessages();
    try {
      const response = await fetch(
        `/api/admin/services/${serviceId}/media/${mediaId}`,
        {
          method: "DELETE",
          headers: { "x-csrf-token": await csrfToken() },
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      setServices((prev) =>
        prev.map((service) =>
          service.id === serviceId
            ? {
                ...service,
                media: service.media.filter((item) => item.id !== mediaId),
              }
            : service,
        ),
      );
      setNotice("Медиа удалено.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось удалить медиа.",
      );
    }
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    resetMessages();
    setSavingSettings(true);
    try {
      const response = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": await csrfToken(),
        },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      setSettings(data.settings);
      setNotice("Настройки сайта сохранены.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось сохранить настройки сайта.",
      );
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <>
      <header className="admin-header border-b border-border bg-panel">
        <div className="site-shell flex min-h-20 items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <p className="brand-mark text-text">TRIOZ / ADMIN</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className="site-shell admin-shell py-10 sm:py-14">
        <div>
          <h1 className="type-h2 mt-3 text-text">Админ-панель</h1>
        </div>

        {notice ? (
          <div
            className="mt-6 rounded-2xl border border-border-hover bg-panel-2 px-4 py-3 type-body text-success"
            role="status"
          >
            {notice}
          </div>
        ) : null}
        {error ? (
          <div
            className="mt-6 rounded-2xl border border-danger bg-panel-2 px-4 py-3 type-body text-danger"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <nav
          className="mt-8 flex flex-wrap gap-2"
          aria-label="Разделы админ-панели"
        >
          {(
            [
              ["services", "Услуги"],
              ["projects", "Проекты"],
              ["leads", "Заявки"],
              ["clients", "Клиенты"],
              ["settings", "Настройки сайта"],
              ["integrations", "Интеграции"],
              ["billing", "Товары и подписки"],
              ["documents", "Документы"],
              ["analytics", "Аналитика"],
              ["invoices", "Счета"],
              ["commerce", "Продажи и условия"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={
                activeSection === id ? "button-primary" : "button-secondary"
              }
              onClick={() => setActiveSection(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {activeSection === "integrations" ? <AdminIntegrations /> : null}
        {activeSection === "billing" ? <AdminBillingPlans /> : null}
        {activeSection === "documents" ? <AdminDocuments /> : null}
        {activeSection === "analytics" ? <AdminAnalytics /> : null}
        {activeSection === "commerce" ? <AdminCommerce /> : null}

        {activeSection === "services" ? (
          <section
            className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]"
            aria-labelledby="services-admin-title"
          >
            <div>
              <h2 id="services-admin-title" className="type-h2 mt-2 text-text">
                Услуги
              </h2>

              <button
                type="button"
                className="button-secondary mt-4"
                onClick={() => setActiveSection("billing")}
              >
                Настроить тарифы и режим оплаты →
              </button>
            </div>

            <div className="space-y-5">
              <form onSubmit={createService} className="panel space-y-5 p-6">
                <h3 className="type-h3 text-text">Добавить услугу</h3>
                <ServiceFields
                  values={serviceForm}
                  setValues={setServiceForm}
                  prefix="create-service"
                />
                <div>
                  <label
                    className="mb-2 block type-ui font-semibold text-text"
                    htmlFor="service-create-media"
                  >
                    Изображения и видео
                  </label>
                  <input
                    id="service-create-media"
                    className="field file:mr-3 file:rounded-full file:border-0 file:bg-panel-2 file:px-3 file:py-2"
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                    onChange={(event) =>
                      setServiceFiles(Array.from(event.target.files ?? []))
                    }
                  />
                </div>
                <button
                  type="submit"
                  className="button-primary w-full"
                  disabled={savingService}
                >
                  {savingService ? "Сохранение…" : "Создать услугу"}
                </button>
              </form>

              {services.map((service) => (
                <ServiceEditorCard
                  key={service.id}
                  service={service}
                  onSave={updateService}
                  onDelete={deleteService}
                  onMediaOrder={updateMediaOrder}
                  onMediaDelete={deleteMedia}
                />
              ))}
            </div>
          </section>
        ) : null}

        {activeSection === "projects" ? (
          <section
            className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]"
            aria-labelledby="projects-admin-title"
          >
            <div>
              <h2 id="projects-admin-title" className="type-h2 mt-2 text-text">
                Проекты
              </h2>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  aria-label="Фильтр по клиенту"
                  className="field"
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                >
                  <option value="all">Все клиенты</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Фильтр по статусу"
                  className="field"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Все статусы</option>
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <ProjectCreateForm
                clients={clients}
                onCreated={(project) => {
                  setProjects((prev) => [project, ...prev]);
                  setNotice("Проект создан.");
                }}
                onError={setError}
              />
              <div className="space-y-4">
                {filteredProjects.length === 0 ? (
                  <div className="panel p-6 type-body text-muted">
                    По заданным фильтрам проектов нет.
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <ProjectEditCard
                      key={project.id}
                      project={project}
                      clients={clients}
                      onUpdated={(next) =>
                        setProjects((prev) =>
                          prev.map((item) =>
                            item.id === next.id ? next : item,
                          ),
                        )
                      }
                      onDeleted={deleteProject}
                      onError={setError}
                    />
                  ))
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeSection === "leads" ? (
          <section className="mt-10" aria-labelledby="leads-title">
            <div className="grid gap-8 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
              <div>
                <h2 id="leads-title" className="type-h2 mt-2 text-text">
                  Заявки клиентов
                </h2>
              </div>
            </div>
            <div className="mt-8">
              <LeadAdminTable
                initialLeads={leads}
                onError={setError}
                onChange={setLeads}
              />
            </div>
          </section>
        ) : null}

        {activeSection === "invoices" ? (
          <AdminInvoices clients={clients} />
        ) : null}
        {activeSection === "clients" ? (
          <AdminClients onUpdated={() => router.refresh()} />
        ) : null}

        {activeSection === "settings" ? (
          <section
            className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]"
            aria-labelledby="settings-title"
          >
            <div>
              <h2 id="settings-title" className="type-h2 mt-2 text-text">
                Настройки сайта
              </h2>
            </div>
            <form onSubmit={saveSettings} className="panel space-y-5 p-6">
              {(
                [
                  [
                    "tagline",
                    "Девиз",
                    settings.tagline,
                    "Короткая формулировка результата и ответственности.",
                  ],
                  [
                    "heroTitle",
                    "Заголовок первого экрана",
                    settings.heroTitle,
                    "Главный заголовок.",
                  ],
                  [
                    "heroSubtitle",
                    "Текст первого экрана",
                    settings.heroSubtitle,
                    "Развёрнутое пояснение под заголовком.",
                  ],
                  [
                    "contacts",
                    "Контакты",
                    settings.contacts,
                    "Телефон, email, ссылка или любой необходимый контактный текст.",
                  ],
                ] as const
              ).map(([key, label, value]) => (
                <div key={key}>
                  <label
                    className="mb-2 block type-ui font-semibold text-text"
                    htmlFor={`settings-${key}`}
                  >
                    {label}
                  </label>
                  {key === "heroSubtitle" || key === "contacts" ? (
                    <textarea
                      id={`settings-${key}`}
                      className="field min-h-32 resize-y"
                      required
                      value={value}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <input
                      id={`settings-${key}`}
                      className="field"
                      required
                      value={value}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              ))}
              <button
                className="button-primary w-full"
                type="submit"
                disabled={savingSettings}
              >
                {savingSettings ? "Сохранение…" : "Сохранить настройки"}
              </button>
            </form>
          </section>
        ) : null}
      </section>
    </>
  );
}

function ServiceFields({
  values,
  setValues,
  prefix,
}: {
  values: typeof blankService;
  setValues: React.Dispatch<React.SetStateAction<typeof blankService>>;
  prefix: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label
          className="mb-2 block type-ui font-semibold text-text"
          htmlFor={`${prefix}-slug`}
        >
          Slug
        </label>
        <input
          id={`${prefix}-slug`}
          className="field"
          required
          maxLength={80}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          value={values.slug}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, slug: e.target.value }))
          }
        />
      </div>
      <div>
        <label
          className="mb-2 block type-ui font-semibold text-text"
          htmlFor={`${prefix}-sort`}
        >
          Порядок
        </label>
        <input
          id={`${prefix}-sort`}
          className="field"
          required
          type="number"
          min={0}
          max={100000}
          value={values.sortOrder}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, sortOrder: e.target.value }))
          }
        />
      </div>
      <div className="sm:col-span-2">
        <label
          className="mb-2 block type-ui font-semibold text-text"
          htmlFor={`${prefix}-title`}
        >
          Название
        </label>
        <input
          id={`${prefix}-title`}
          className="field"
          required
          maxLength={160}
          value={values.title}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, title: e.target.value }))
          }
        />
      </div>
      <div className="sm:col-span-2">
        <label
          className="mb-2 block type-ui font-semibold text-text"
          htmlFor={`${prefix}-short`}
        >
          Короткое описание
        </label>
        <textarea
          id={`${prefix}-short`}
          className="field min-h-28 resize-y"
          required
          maxLength={1000}
          value={values.shortDescription}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, shortDescription: e.target.value }))
          }
        />
      </div>
      <div className="sm:col-span-2">
        <label
          className="mb-2 block type-ui font-semibold text-text"
          htmlFor={`${prefix}-full`}
        >
          Развёрнутое описание
        </label>
        <textarea
          id={`${prefix}-full`}
          className="field min-h-36 resize-y"
          required
          maxLength={10000}
          value={values.fullDescription}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, fullDescription: e.target.value }))
          }
        />
      </div>
      <div>
        <label
          className="mb-2 block type-ui font-semibold text-text"
          htmlFor={`${prefix}-includes`}
        >
          Состав услуги
        </label>
        <textarea
          id={`${prefix}-includes`}
          className="field min-h-44 resize-y"
          required
          placeholder="Один пункт на строку"
          value={values.includes}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, includes: e.target.value }))
          }
        />
      </div>
      <div>
        <label
          className="mb-2 block type-ui font-semibold text-text"
          htmlFor={`${prefix}-stages`}
        >
          Этапы работы
        </label>
        <textarea
          id={`${prefix}-stages`}
          className="field min-h-44 resize-y"
          required
          placeholder="Один этап на строку"
          value={values.stages}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, stages: e.target.value }))
          }
        />
      </div>
      <label className="sm:col-span-2 flex min-h-12 items-center gap-3 type-ui text-text">
        <input
          type="checkbox"
          className="h-5 w-5 accent-accent"
          checked={values.isPublished}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, isPublished: e.target.checked }))
          }
        />
        <span>Публиковать на лендинге</span>
      </label>
    </div>
  );
}

function ServiceEditorCard({
  service,
  onSave,
  onDelete,
  onMediaOrder,
  onMediaDelete,
}: {
  service: ServiceView;
  onSave: (next: ServiceView, files: File[]) => Promise<ServiceView | null>;
  onDelete: (id: string) => void;
  onMediaOrder: (serviceId: string, mediaId: string, sortOrder: number) => void;
  onMediaDelete: (serviceId: string, mediaId: string) => void;
}) {
  const [draft, setDraft] = useState({
    slug: service.slug,
    title: service.title,
    shortDescription: service.shortDescription,
    fullDescription: service.fullDescription,
    includes: listToLines(service.includes),
    stages: listToLines(service.stages),
    sortOrder: String(service.sortOrder),
    isPublished: service.isPublished,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const saved = await onSave(
      {
        ...service,
        slug: draft.slug,
        title: draft.title,
        shortDescription: draft.shortDescription,
        fullDescription: draft.fullDescription,
        includes: linesToList(draft.includes),
        stages: linesToList(draft.stages),
        sortOrder: Number(draft.sortOrder),
        isPublished: draft.isPublished,
      },
      files,
    );
    if (saved) setFiles([]);
    setSaving(false);
  }

  return (
    <details className="panel overflow-hidden">
      <summary className="cursor-pointer px-6 py-5">
        <span className="flex flex-wrap items-center gap-3">
          <span className="type-h3 text-text">{service.title}</span>
          <span className="status-pill">
            {service.isPublished ? "Опубликовано" : "Скрыто"}
          </span>
          <span className="type-ui text-subtle">
            Порядок {service.sortOrder}
          </span>
        </span>
      </summary>

      <form onSubmit={submit} className="space-y-6 border-t border-border p-6">
        <ServiceFields
          prefix={`service-${service.id}`}
          values={draft}
          setValues={setDraft}
        />

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="type-h3 text-text">Медиа</h3>
            <label className="button-secondary cursor-pointer">
              Добавить файлы
              <input
                className="sr-only"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                onChange={(event) =>
                  setFiles(Array.from(event.target.files ?? []))
                }
              />
            </label>
          </div>

          {files.length ? (
            <p className="mt-3 type-body text-muted">
              К загрузке: {files.map((file) => file.name).join(", ")}
            </p>
          ) : null}

          <div className="mt-5 grid gap-3">
            {service.media.length === 0 ? (
              <div className="rounded-2xl border border-border bg-panel-2 p-5 type-body text-subtle">
                Медиа пока нет.
              </div>
            ) : (
              service.media.map((media) => (
                <div
                  key={media.id}
                  className="grid gap-3 rounded-2xl border border-border bg-panel-2 p-4 sm:grid-cols-[1fr_130px_auto] sm:items-center"
                >
                  <a
                    href={media.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="type-body font-semibold text-text hover:text-accent"
                  >
                    {media.type === "VIDEO" ? "Видео" : "Изображение"} · открыть
                  </a>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    max={100000}
                    aria-label={`Порядок медиа ${media.id}`}
                    defaultValue={media.sortOrder}
                    onBlur={(event) =>
                      onMediaOrder(
                        service.id,
                        media.id,
                        Number(event.currentTarget.value),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="button-secondary text-danger"
                    onClick={() => onMediaDelete(service.id, media.id)}
                  >
                    Удалить
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="button-primary" type="submit" disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить услугу"}
          </button>
          <a
            className="button-secondary"
            href={`/?service=${encodeURIComponent(service.slug)}`}
            target="_blank"
            rel="noreferrer"
          >
            Открыть карточку
          </a>
          <button
            type="button"
            className="button-secondary text-danger"
            onClick={() => onDelete(service.id)}
          >
            Удалить услугу
          </button>
        </div>
      </form>
    </details>
  );
}

function ProjectFields({
  clients,
  values,
  setValues,
  fileId,
}: {
  clients: Client[];
  values: {
    title: string;
    description: string;
    projectUrl: string;
    status: Project["status"];
    isPublic: boolean;
    clientId: string;
  };
  setValues: React.Dispatch<
    React.SetStateAction<{
      title: string;
      description: string;
      projectUrl: string;
      status: Project["status"];
      isPublic: boolean;
      clientId: string;
    }>
  >;
  fileId: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label
          className="mb-2 block type-ui font-semibold text-text"
          htmlFor={`${fileId}-title`}
        >
          Название
        </label>
        <input
          id={`${fileId}-title`}
          className="field"
          required
          maxLength={160}
          value={values.title}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, title: e.target.value }))
          }
        />
      </div>
      <div className="sm:col-span-2">
        <label
          className="mb-2 block type-ui font-semibold text-text"
          htmlFor={`${fileId}-description`}
        >
          Описание
        </label>
        <textarea
          id={`${fileId}-description`}
          className="field min-h-28 resize-y"
          required
          maxLength={5000}
          value={values.description}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, description: e.target.value }))
          }
        />
      </div>
      <div className="sm:col-span-2">
        <label
          className="mb-2 block type-ui font-semibold text-text"
          htmlFor={`${fileId}-url`}
        >
          URL проекта
        </label>
        <input
          id={`${fileId}-url`}
          className="field"
          required
          type="url"
          value={values.projectUrl}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, projectUrl: e.target.value }))
          }
        />
      </div>
      <div>
        <label
          className="mb-2 block type-ui font-semibold text-text"
          htmlFor={`${fileId}-status`}
        >
          Статус
        </label>
        <select
          id={`${fileId}-status`}
          className="field"
          value={values.status}
          onChange={(e) =>
            setValues((prev) => ({
              ...prev,
              status: e.target.value as "IN_PROGRESS" | "DONE" | "SUPPORT",
            }))
          }
        >
          {PROJECT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          className="mb-2 block type-ui font-semibold text-text"
          htmlFor={`${fileId}-client`}
        >
          Клиент
        </label>
        <select
          id={`${fileId}-client`}
          className="field"
          value={values.clientId}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, clientId: e.target.value }))
          }
        >
          <option value="">Без назначения</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} · {client.email}
            </option>
          ))}
        </select>
      </div>
      <label className="sm:col-span-2 flex min-h-12 items-center gap-3 type-ui text-text">
        <input
          type="checkbox"
          className="h-5 w-5 accent-accent"
          checked={values.isPublic}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, isPublic: e.target.checked }))
          }
        />
        <span>Показывать в публичном слайдере проектов</span>
      </label>
    </div>
  );
}

function ProjectCreateForm({
  clients,
  onCreated,
  onError,
}: {
  clients: Client[];
  onCreated: (project: Project) => void;
  onError: (message: string) => void;
}) {
  const blank: {
    title: string;
    description: string;
    projectUrl: string;
    status: Project["status"];
    isPublic: boolean;
    clientId: string;
  } = {
    title: "",
    description: "",
    projectUrl: "",
    status: "IN_PROGRESS",
    isPublic: false,
    clientId: "",
  };
  const [values, setValues] = useState<typeof blank>(blank);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    onError("");
    try {
      const form = new FormData();
      Object.entries(values).forEach(([key, value]) =>
        form.append(key, String(value)),
      );
      if (file) form.append("preview", file);
      const response = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "x-csrf-token": await csrfToken() },
        body: form,
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      onCreated(data.project);
      setValues(blank);
      setFile(null);
    } catch (cause) {
      onError(
        cause instanceof Error ? cause.message : "Не удалось создать проект.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel space-y-5 p-6">
      <h3 className="type-h3 text-text">Добавить проект</h3>
      <ProjectFields
        clients={clients}
        values={values}
        setValues={setValues}
        fileId="project-create"
      />
      <div>
        <label
          className="mb-2 block type-ui font-semibold text-text"
          htmlFor="project-create-preview"
        >
          Превью
        </label>
        <input
          id="project-create-preview"
          className="field"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <button
        className="button-primary w-full"
        type="submit"
        disabled={loading}
      >
        {loading ? "Сохранение…" : "Создать проект"}
      </button>
    </form>
  );
}

function ProjectEditCard({
  project,
  clients,
  onUpdated,
  onDeleted,
  onError,
}: {
  project: Project;
  clients: Client[];
  onUpdated: (project: Project) => void;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
}) {
  const [values, setValues] = useState({
    title: project.title,
    description: project.description,
    projectUrl: project.projectUrl,
    status: project.status,
    isPublic: project.isPublic,
    clientId: project.clientId ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    onError("");
    try {
      const form = new FormData();
      Object.entries(values).forEach(([key, value]) =>
        form.append(key, String(value)),
      );
      if (file) form.append("preview", file);
      const response = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "x-csrf-token": await csrfToken() },
        body: form,
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      onUpdated(data.project);
      setFile(null);
    } catch (cause) {
      onError(
        cause instanceof Error ? cause.message : "Не удалось обновить проект.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="panel p-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative h-28 w-full overflow-hidden rounded-2xl border border-border bg-panel-2 sm:w-44">
          <img
            src={project.previewPath}
            alt={`Превью проекта «${project.title}»`}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="type-h3 text-text">{project.title}</h3>
            <span className="status-pill">{STATUS_LABELS[project.status]}</span>
            {project.isPublic ? (
              <span className="status-pill text-accent">PUBLIC</span>
            ) : null}
          </div>
          <p className="mt-2 type-body text-subtle">
            Клиент: {project.client?.name ?? "не назначен"} · Обновлён{" "}
            {new Date(project.updatedAt).toLocaleString("ru-RU")}
          </p>
        </div>
      </div>

      <details className="mt-6">
        <summary className="cursor-pointer type-ui font-semibold text-accent">
          Редактировать проект
        </summary>
        <div className="pt-6">
          <ProjectFields
            clients={clients}
            values={values}
            setValues={setValues}
            fileId={`project-${project.id}`}
          />
          <div className="mt-5">
            <label
              className="mb-2 block type-ui font-semibold text-text"
              htmlFor={`preview-${project.id}`}
            >
              Новое превью
            </label>
            <input
              id={`preview-${project.id}`}
              className="field"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button className="button-primary" type="submit" disabled={loading}>
              {loading ? "Сохранение…" : "Сохранить изменения"}
            </button>
            <a
              className="button-secondary"
              href={project.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Открыть <ArrowUpRight />
            </a>
            <button
              className="button-secondary text-danger"
              type="button"
              onClick={() => onDeleted(project.id)}
            >
              Удалить проект
            </button>
          </div>
        </div>
      </details>
    </form>
  );
}
