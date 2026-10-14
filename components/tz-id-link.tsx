"use client";
import { useState } from "react";
export function TzIdLink() {
  const [password, setPassword] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function link(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const csrf = await fetch("/api/auth/csrf"); if (!csrf.ok) throw new Error("CSRF недоступен.");
      const { token } = await csrf.json();
      const response = await fetch("/api/auth/tz-id/link", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ currentPassword: password }) });
      setPassword(""); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Не удалось начать связывание.");
      const url = new URL(data.authorizationUrl); if (url.origin !== "https://id.trioz.ru") throw new Error("Некорректный адрес входа.");
      window.location.assign(url.href);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Связывание не выполнено."); setBusy(false); }
  }
  return <form className="panel space-y-4 p-6" onSubmit={link}><h2 className="type-h3">Связать существующий аккаунт с TZ ID</h2><p className="type-body text-muted">Сначала подтвердите пароль аккаунта Business, затем войдите в нужный TZ ID. Совпадение email не связывает аккаунты автоматически.</p><label className="block type-ui" htmlFor="link-password">Текущий пароль Business</label><input id="link-password" className="field max-w-md" type="password" required minLength={10} maxLength={200} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />{error ? <p role="alert" className="text-danger">{error}</p> : null}<button className="button-primary" disabled={busy} type="submit">Подтвердить и перейти в TZ ID</button></form>;
}
