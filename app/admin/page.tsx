import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAllServices } from "@/lib/service-content";
import { getSiteSettingsOrDefaults } from "@/lib/site-settings";
import { AdminConsole } from "@/components/admin-console";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TRIOZ — админка",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage() {
  await requireRole("ADMIN");

  const [clients, projects, services, settings, leads] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CLIENT" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: { client: { select: { id: true, name: true, email: true } } },
    }),
    getAllServices(),
    getSiteSettingsOrDefaults(),
    prisma.leadRequest.findMany({ orderBy: { createdAt: "desc" }, include: { service: { select: { slug: true, title: true } } } }),
  ]);

  return (
    <main className="min-h-screen bg-bg text-text">
      <AdminConsole
        initialClients={clients.map((client) => ({ ...client, createdAt: client.createdAt.toISOString() }))}
        initialProjects={projects.map((project) => ({ ...project, createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString() }))}
        initialServices={services}
        initialLeads={leads.map((lead) => ({ ...lead, createdAt: lead.createdAt.toISOString(), updatedAt: lead.updatedAt.toISOString() }))}
        initialSettings={{
          id: settings.id,
          tagline: settings.tagline,
          heroTitle: settings.heroTitle,
          heroSubtitle: settings.heroSubtitle,
          contacts: settings.contacts,
        }}
      />
    </main>
  );
}
