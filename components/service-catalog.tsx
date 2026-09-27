"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ServiceView } from "@/lib/service-content";
import { ScrollReveal } from "./scroll-reveal";
import { ServiceCard } from "./service-card";
import { ServiceModal } from "./service-modal";

export function ServiceCatalog({ services, initialSlug }: { services: ServiceView[]; initialSlug?: string }) {
  const [selectedSlug, setSelectedSlug] = useState(initialSlug);

  const selectedService = useMemo(
    () => services.find((service) => service.slug === selectedSlug) ?? null,
    [selectedSlug, services],
  );

  useEffect(() => {
    function syncFromUrl() {
      const slug = new URL(window.location.href).searchParams.get("service") ?? undefined;
      setSelectedSlug(slug);
    }

    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const syncUrl = useCallback((slug?: string) => {
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("service", slug);
    else url.searchParams.delete("service");
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  const openService = useCallback((slug: string, trigger: HTMLButtonElement) => {
    trigger.focus();
    syncUrl(slug);
  }, [syncUrl]);

  const closeService = useCallback(() => {
    syncUrl();
  }, [syncUrl]);

  return (
    <>
      <div className="service-list">
        {services.map((service, index) => (
          <ScrollReveal key={service.slug} delay={Math.min(index * 35, 280)}>
            <ServiceCard service={service} index={index} onOpen={openService} />
          </ScrollReveal>
        ))}
      </div>

      {selectedService ? (
        <ServiceModal
          service={selectedService}
          services={services}
          onClose={closeService}
          onChange={syncUrl}
        />
      ) : null}
    </>
  );
}
