"use client";

import { useState } from "react";
import type { ServiceView } from "@/lib/service-content";
import { ArrowUpRight, MenuIcon, XIcon } from "./icons";

export function ServiceDock({ services }: { services: ServiceView[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="service-dock group fixed left-0 top-0 z-50 hidden h-screen w-14 overflow-hidden lg:block" aria-label="Навигация по услугам">
        <div className="service-dock__rail flex h-full w-14 flex-col items-center py-6">
          <span className="type-ui [writing-mode:vertical-rl]">Услуги</span>
          <span className="mt-5 h-12 w-px bg-border" aria-hidden="true" />
          <span className="mt-auto type-ui [writing-mode:vertical-rl]">TRIOZ</span>
        </div>

        <div className="service-dock__panel absolute left-0 top-0 flex h-full w-[360px] -translate-x-full flex-col pl-14 pr-8 pt-9 shadow-modal transition-transform duration-300 group-hover:translate-x-0 group-focus-within:translate-x-0">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Team / Capabilities</p>
              <p className="mt-3 max-w-[260px] type-h3 text-text">Всё, что нужно для цифровой работы бизнеса.</p>
            </div>
            <span className="type-ui text-accent">{services.length}</span>
          </div>

          <nav className="mt-10 overflow-y-auto pb-6" aria-label="Услуги TRIOZ">
            <ol className="divide-y divide-border">
              {services.map((service, index) => (
                <li key={service.slug}>
                  <a href={`/?service=${encodeURIComponent(service.slug)}`} className="group/item flex items-start gap-4 py-4">
                    <span className="type-ui text-subtle">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block type-ui font-semibold text-text transition-transform duration-200 group-hover/item:translate-x-1">{service.title}</span>
                      <span className="mt-1 block type-ui text-muted">{service.shortDescription}</span>
                    </span>
                    <ArrowUpRight />
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </aside>

      <div className="fixed left-4 top-4 z-50 lg:hidden">
        <button type="button" className="icon-button" aria-label={open ? "Закрыть меню услуг" : "Открыть меню услуг"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? <XIcon /> : <MenuIcon />}
        </button>
      </div>

      <div className={`fixed inset-0 z-40 lg:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
        <button type="button" className={`absolute inset-0 mobile-menu-overlay transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} aria-label="Закрыть меню" />
        <div className={`absolute left-0 top-0 h-full w-[min(90vw,380px)] border-r border-border bg-bg px-6 pb-8 pt-24 shadow-modal transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <p className="eyebrow">Team / Capabilities</p>
          <h2 className="mt-3 max-w-[300px] type-h3 text-text">Виды услуг команды</h2>
          <nav className="mt-8 overflow-y-auto" aria-label="Услуги TRIOZ">
            <ol className="divide-y divide-border">
              {services.map((service, index) => (
                <li key={service.slug}>
                  <a href={`/?service=${encodeURIComponent(service.slug)}`} onClick={() => setOpen(false)} className="flex items-start gap-3 py-4">
                    <span className="type-ui text-subtle">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block type-ui font-semibold text-text">{service.title}</span>
                      <span className="mt-1 block type-ui text-muted">{service.shortDescription}</span>
                    </span>
                    <ArrowUpRight />
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </>
  );
}
