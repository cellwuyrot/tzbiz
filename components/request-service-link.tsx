"use client";
import type { MouseEvent, ReactNode } from "react";
import { REQUEST_SERVICE_EVENT, requestServiceUrl } from "@/lib/request-service";

export function RequestServiceLink({ serviceSlug, children, className, ariaLabel }: {
  serviceSlug?: string; children: ReactNode; className?: string; ariaLabel?: string;
}) {
  function request(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (window.location.pathname !== "/" || !document.getElementById("contact")) return;
    event.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.delete("service"); // Close the catalog modal, not the lead form.
    if (serviceSlug) url.searchParams.set("requestService", serviceSlug);
    url.hash = "contact";
    window.history.pushState(window.history.state, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new CustomEvent(REQUEST_SERVICE_EVENT, { detail: { serviceSlug } }));
    // Wait for modal cleanup/focus restoration before focusing the retained form.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById("contact")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      document.getElementById("lead-service")?.focus({ preventScroll: true });
    }));
  }
  return <a href={requestServiceUrl(serviceSlug)} className={className} aria-label={ariaLabel} onClick={request}>{children}</a>;
}
