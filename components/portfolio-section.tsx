import { ScrollReveal } from "./scroll-reveal";
import { PortfolioSlider } from "./portfolio-slider";

type PortfolioProject = {
  id: string;
  title: string;
  projectUrl: string;
  previewPath: string;
};

export function PortfolioSection({ projects }: { projects: PortfolioProject[] }) {
  return (
    <section id="portfolio" className="site-shell py-28 lg:py-36" aria-labelledby="portfolio-title">
      <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <ScrollReveal>
          <p className="eyebrow">Selected / Projects</p>
          <h2 id="portfolio-title" className="type-h2 max-w-xl text-text">Реализованные проекты.</h2>
        </ScrollReveal>
        <ScrollReveal delay={80}>
          <p className="max-w-2xl type-lead text-muted">На слайдере — проекты, которые опубликованы через админ-панель. Каждое изображение ведёт напрямую на проект.</p>
        </ScrollReveal>
      </div>

      <ScrollReveal className="mt-12">
        <PortfolioSlider projects={projects} />
      </ScrollReveal>
    </section>
  );
}
