"use client";

import { useEffect, useRef, useState } from "react";
import type { ServiceView } from "@/lib/service-content";
import { ArrowUpRight, ChevronLeft, ChevronRight, XIcon } from "./icons";

export function ServiceModal({
  service,
  services,
  onClose,
  onChange,
}: {
  service: ServiceView;
  services: ServiceView[];
  onClose: () => void;
  onChange: (slug: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    setMediaIndex(0);
  }, [service.id]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowLeft" && service.media.length > 1) {
        event.preventDefault();
        setMediaIndex((index) => (index - 1 + service.media.length) % service.media.length);
        return;
      }

      if (event.key === "ArrowRight" && service.media.length > 1) {
        event.preventDefault();
        setMediaIndex((index) => (index + 1) % service.media.length);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, video[tabindex="0"], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));

      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, service.media.length]);

  const media = service.media[mediaIndex];
  const index = services.findIndex((item) => item.slug === service.slug);
  const previousService = services[(index - 1 + services.length) % services.length];
  const nextService = services[(index + 1) % services.length];

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-dialog-title"
        aria-describedby="service-dialog-description"
        tabIndex={-1}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-panel px-5 py-4 backdrop-blur sm:px-7">
          <p className="eyebrow">Услуга / {String(index + 1).padStart(2, "0")}</p>
          <button ref={closeRef} data-dialog-close type="button" className="icon-button" onClick={onClose} aria-label="Закрыть карточку услуги">
            <XIcon />
          </button>
        </div>

        <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h2 id="service-dialog-title" className="type-h2 text-text">{service.title}</h2>
            <p id="service-dialog-description" className="mt-5 type-lead text-muted">{service.fullDescription}</p>

            <div className="mt-9 grid gap-8 sm:grid-cols-2">
              <section aria-labelledby="service-includes-title">
                <h3 id="service-includes-title" className="type-h3 text-text">Состав услуги</h3>
                <ol className="mt-5 grid gap-3">
                  {service.includes.map((item, itemIndex) => (
                    <li key={`${item}-${itemIndex}`} className="flex gap-3 type-body text-muted">
                      <span className="mt-1 shrink-0 type-ui text-accent">{String(itemIndex + 1).padStart(2, "0")}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section aria-labelledby="service-stages-title">
                <h3 id="service-stages-title" className="type-h3 text-text">Этапы работы</h3>
                <ol className="mt-5 grid gap-3">
                  {service.stages.map((item, itemIndex) => (
                    <li key={`${item}-${itemIndex}`} className="flex gap-3 type-body text-muted">
                      <span className="mt-1 shrink-0 type-ui text-accent">{String(itemIndex + 1).padStart(2, "0")}</span>
                      <span>{item.replace(/^Этап\s+\d+\.\s*/, "")}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <div className="mt-9 flex flex-wrap gap-3">
              <a
                className="button-primary"
                href={`https://trioz.ru/connect?service=${encodeURIComponent(service.slug)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Заказать услугу <ArrowUpRight />
              </a>
              <a className="button-secondary" href={`/services/${encodeURIComponent(service.slug)}`}>Подробнее как отдельная страница <ChevronRight /></a>
              <button type="button" className="button-secondary" onClick={() => onChange(previousService.slug)} disabled={services.length < 2}>
                <ChevronLeft /> Предыдущая
              </button>
              <button type="button" className="button-secondary" onClick={() => onChange(nextService.slug)} disabled={services.length < 2}>
                Следующая <ChevronRight />
              </button>
            </div>
          </div>

          <aside aria-label={`Галерея услуги «${service.title}»`}>
            {service.media.length ? (
              <div className="lg:sticky lg:top-20">
                <div className="gallery-stage">
                  {media?.type === "VIDEO" ? (
                    <video controls preload="metadata" src={media.path} aria-label={`Видео услуги «${service.title}»`} />
                  ) : media ? (
                    <img src={media.path} alt="" />
                  ) : null}
                </div>
                {service.media.length > 1 ? (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button type="button" className="icon-button" onClick={() => setMediaIndex((current) => (current - 1 + service.media.length) % service.media.length)} aria-label="Предыдущий материал">
                      <ChevronLeft />
                    </button>
                    <span className="type-ui text-subtle" aria-live="polite">{mediaIndex + 1} / {service.media.length}</span>
                    <button type="button" className="icon-button" onClick={() => setMediaIndex((current) => (current + 1) % service.media.length)} aria-label="Следующий материал">
                      <ChevronRight />
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="panel grid min-h-60 place-items-center p-6 text-center">
                <p className="type-body text-subtle">Медиа пока не добавлены. Полное содержание услуги доступно выше.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
