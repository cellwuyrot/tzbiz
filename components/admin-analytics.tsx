"use client";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
type Data = {
  total: number;
  since: string;
  rows: { path: string; views: number }[];
};
export function AdminAnalytics() {
  const [days, setDays] = useState(30),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [tick, setTick] = useState(0);
  useEffect(() => {
    let current = true;
    setError("");
    adminFetch<Data>(`/api/admin/analytics?days=${days}`)
      .then((d) => {
        if (current) setData(d);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [days, tick]);
  return (
    <section className="mt-8 space-y-6">
      <h2 className="type-h2">Аналитика</h2>
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Период аналитики"
          className="field max-w-xs"
          value={days}
          onChange={(e) => {
            setDays(Number(e.target.value));
            setData(null);
          }}
        >
          {[7, 30, 90, 180].map((n) => (
            <option value={n} key={n}>
              {n} дней
            </option>
          ))}
        </select>
        <button
          className="button-secondary"
          onClick={() => setTick((n) => n + 1)}
        >
          Обновить
        </button>
      </div>
      {error && (
        <p role="alert" className="panel p-5 text-danger">
          {error}
        </p>
      )}
      {data && (
        <>
          <div className="panel p-6 space-y-3">
            <p className="type-ui text-muted">
              Просмотры с согласия посетителей · дни UTC с {data.since}
            </p>
            <p className="type-h2">{data.total}</p>
            <p className="type-ui text-muted">
              Не уникальные посетители. Без согласия и на приватных страницах
              просмотры не учитываются.
            </p>
          </div>
          <div className="panel p-5 space-y-4">
            {data.rows.map((r) => (
              <div
                key={r.path}
                className="flex items-start justify-between gap-4 type-body"
              >
                <span className="min-w-0 break-all">{r.path}</span>
                <strong>{r.views}</strong>
              </div>
            ))}
            {!data.rows.length && (
              <p className="text-muted">Просмотров за этот период нет.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
