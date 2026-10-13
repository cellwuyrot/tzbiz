import type { ServiceView } from "@/lib/service-content";
import { RequestServiceLink } from "./request-service-link";
import { ArrowUpRight, ServiceIcon } from "./icons";

export function ServiceCard({ service, index, onOpen }: { service: ServiceView; index: number; onOpen: (slug: string, trigger: HTMLButtonElement) => void }) {
  return (
    <article id={`service-${service.slug}`} className="service-row group scroll-mt-28">
      <div className="service-row__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
      <div className="service-row__icon"><ServiceIcon index={index} /></div>
      <div className="min-w-0">
        <button
          type="button"
          className="service-trigger"
          onClick={(event) => onOpen(service.slug, event.currentTarget)}
          aria-label={`Открыть полную карточку услуги «${service.title}»`}
        >
          <h3 className="type-h3 text-text">{service.title}</h3>
          <p className="mt-2 max-w-3xl type-body text-muted">{service.shortDescription}</p>
        </button>
      </div>
      <RequestServiceLink
        serviceSlug={service.slug}
        className="service-row__action type-ui font-semibold"
        ariaLabel={`Заказать услугу «${service.title}»`}
      >
        <span>Заказать</span><ArrowUpRight />
      </RequestServiceLink>
      <div className="service-row__signal" aria-hidden="true" />
    </article>
  );
}
