"use client";

import { useEffect, useState } from "react";
import { LockIcon } from "./icons";

export function LoginForm({ adminOnly = false }: { adminOnly?: boolean }) {
  const [csrf, setCsrf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/csrf", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => setCsrf(data.token ?? ""))
      .catch(() => setError("Не удалось подготовить защищённую форму."));
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ email, password, adminOnly }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось выполнить вход.");
      if (adminOnly && data.role !== "ADMIN") throw new Error("Этот вход доступен только администратору.");
      window.location.assign(data.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось выполнить вход.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 border-t border-border pt-6">
      <div>
        <label className="mb-2 block type-ui font-semibold text-text" htmlFor="email">Email</label>
        <input className="field" id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="mb-2 block type-ui font-semibold text-text" htmlFor="password">Пароль</label>
        <input className="field" id="password" name="password" type="password" autoComplete="current-password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error ? <p role="alert" className="rounded-2xl border border-danger bg-panel-2 px-4 py-3 type-body text-danger">{error}</p> : null}
      <button className="cta-dark w-full justify-center" type="submit" disabled={!csrf || loading}>
        {loading ? "Проверяем…" : <><LockIcon /> Войти</>}
      </button>
      <p className="text-center type-body text-subtle">Сессия защищена httpOnly cookie.</p>
    </form>
  );
}
