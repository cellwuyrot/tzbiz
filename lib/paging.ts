export function pageInput(url?: string) {
  const p = new URL(url || "http://localhost").searchParams;
  return {
    page: Math.max(1, Math.min(100000, Number(p.get("page")) || 1)) | 0,
    size: 20,
    q: (p.get("q") || "").trim().slice(0, 120),
  };
}
