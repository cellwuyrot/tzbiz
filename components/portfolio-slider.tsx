"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "./icons";

type PortfolioProject = {
  id: string;
  title: string;
  projectUrl: string;
  previewPath: string;
};

export function PortfolioSlider({ projects }: { projects: PortfolioProject[] }) {
  const [index, setIndex] = useState(0);
  const [slideStep, setSlideStep] = useState(0);
  const firstSlideRef = useRef<HTMLElement | null>(null);

  const measureSlideStep = useCallback(() => {
    const slide = firstSlideRef.current;
    if (!slide) return;

    const track = slide.parentElement;
    if (!track) return;

    const gap = Number.parseFloat(window.getComputedStyle(track).gap || "0");
    setSlideStep(slide.getBoundingClientRect().width + (Number.isFinite(gap) ? gap : 0));
  }, []);

  useEffect(() => {
    measureSlideStep();

    const slide = firstSlideRef.current;
    if (!slide || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measureSlideStep);
    observer.observe(slide);
    return () => observer.disconnect();
  }, [measureSlideStep, projects.length]);

  const move = useCallback((delta: number) => {
    setIndex((current) => Math.min(Math.max(current + delta, 0), projects.length - 1));
  }, [projects.length]);

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(projects.length - 1, 0)));
  }, [projects.length]);

  if (!projects.length) {
    return (
      <div className="panel grid min-h-64 place-items-center p-8 text-center">
        <p className="max-w-2xl type-body text-muted">Публичные проекты появятся здесь после публикации через админ-панель.</p>
      </div>
    );
  }

  return (
    <div
      className="portfolio-shell"
      aria-label="Слайдер реализованных проектов"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
        if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
      }}
    >
      <div className="overflow-hidden">
        <div
          className="portfolio-track"
          style={{ transform: `translate3d(-${index * slideStep}px, 0, 0)` }}
        >
          {projects.map((project, projectIndex) => (
            <article
              key={project.id}
              ref={projectIndex === 0 ? firstSlideRef : undefined}
              className="portfolio-slide"
            >
              <a
                href={project.projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
                aria-label={`Открыть проект «${project.title}»`}
              >
                <div className="portfolio-media">
                  <img src={project.previewPath} alt={`Проект «${project.title}»`} />
                </div>
              </a>
              <div className="mt-5 flex items-start justify-between gap-6">
                <h3 className="type-h3 text-text">{project.title}</h3>
                <span className="type-ui text-subtle">{projectIndex + 1} / {projects.length}</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="type-body text-muted">Нажмите на изображение, чтобы открыть проект. Внутри слайдера можно использовать ← →.</p>
        <div className="flex gap-2">
          <button type="button" className="icon-button" onClick={() => move(-1)} disabled={index === 0} aria-label="Предыдущий проект">
            <ChevronLeft />
          </button>
          <button type="button" className="icon-button" onClick={() => move(1)} disabled={index === projects.length - 1} aria-label="Следующий проект">
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}
