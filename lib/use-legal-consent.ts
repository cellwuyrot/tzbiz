"use client";
import { useEffect, useState } from "react";
export function useLegalConsent() {
  const [state, setState] = useState<{
      ready: boolean;
      versions: Record<string, string>;
    }>({ ready: false, versions: {} }),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/documents", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok)
          throw Error("Не удалось загрузить документы. Обновите страницу.");
        return r.json();
      })
      .then((d) => {
        if (!active) return;
        setState(d);
        if (!d.ready)
          setError(
            "Оформление закрыто: владелец ещё не опубликовал обязательные документы.",
          );
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return {
    ...state,
    error,
    href: (slug: string) =>
      state.versions[slug]
        ? `/documents/${slug}?version=${encodeURIComponent(state.versions[slug])}`
        : slug === "agreement" || slug === "privacy"
          ? `/${slug}`
          : `/documents/${slug}`,
  };
}
