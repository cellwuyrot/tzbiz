import crypto from "node:crypto";
export async function serviceHub(input: Record<string, unknown>, actorToken?: string) {
  if (process.env.SERVICE_HUB_ENABLED !== "1") throw Error("Общий каталог услуг пока не настроен владельцем.");
  const client = process.env.TZ_ID_CLIENT_ID || "", secret = process.env.TZ_ID_CLIENT_SECRET || "";
  if (!client || !secret) throw Error("Не настроен серверный клиент TZ ID.");
  const raw = process.env.SERVICE_HUB_ORIGIN || "https://trioz.ru";
  if (raw !== "https://trioz.ru") throw Error("Для интеграции требуется официальный HTTPS-адрес TrioZ.");
  const body = JSON.stringify(input), stamp = String(Date.now()), nonce = crypto.randomUUID();
  const signature = crypto.createHmac("sha256", secret).update(["trioz-service-hub-v1", client, stamp, nonce, body].join("\n")).digest("hex");
  const r = await fetch(`${raw}/api/integrations/service-hub`, { method: "POST", headers: { "Content-Type": "application/json", "x-service-client": client, "x-service-time": stamp, "x-service-nonce": nonce, "x-service-signature": signature, ...(actorToken ? { "x-service-actor-token": actorToken } : {}) }, body, signal: AbortSignal.timeout(12000), cache: "no-store", redirect: "error" });
  const data = await r.json().catch(() => ({})); if (!r.ok) throw Error(typeof data.error === "string" ? data.error : "Общий каталог временно недоступен"); return data;
}
export type ManagedService = { id: string; clientId: string; title: string; description: string; prices: string; methods: string; accessKind: string; allowCancel: boolean; published: boolean; revision: number };
export async function serviceCatalog(): Promise<ManagedService[]> { return (await serviceHub({ action: "catalog" })).services; }
