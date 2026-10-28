import { requireRole } from "@/lib/auth"; import ServiceHubConsole from "@/components/services/service-hub-console"; import { ServiceSubscriptionsAdmin } from "@/components/services/service-subscriptions-admin";
export const dynamic = "force-dynamic";
export default async function Page() { await requireRole("ADMIN"); return <main className="min-h-screen bg-bg text-text"><div className="site-shell pt-6"><a className="button-secondary" href="/admin">← Админ-панель</a></div><ServiceHubConsole csrf /><ServiceSubscriptionsAdmin /></main>; }
