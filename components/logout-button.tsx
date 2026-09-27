"use client";

import { useEffect, useState } from "react";

export function LogoutButton() {
  const [csrf, setCsrf] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/csrf", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => setCsrf(data.token ?? ""))
      .catch(() => undefined);
  }, []);

  async function logout() {
    setLoading(true);
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "x-csrf-token": csrf },
    });
    if (response.ok) window.location.assign("/");
    else setLoading(false);
  }

  return (
    <button className="button-secondary" type="button" disabled={!csrf || loading} onClick={logout}>
      {loading ? "Выход…" : "Выйти"}
    </button>
  );
}
