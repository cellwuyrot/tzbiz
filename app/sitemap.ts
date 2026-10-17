import { prisma } from "@/lib/db";
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";
import { getPublishedServices } from "@/lib/service-content";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;
  const [services, plans] = await Promise.all([
    getPublishedServices(),
    prisma.billingPlan.findMany({
      where: {
        isPublished: true,
        isArchived: false,
        OR: [
          { kind: { in: ["PREMIUM", "VPN", "PRODUCT"] } },
          { kind: "SERVICE", service: { isPublished: true } },
        ],
      },
      select: { id: true, updatedAt: true },
    }),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/payment`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/plans`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/agreement`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/documents`, changeFrequency: "monthly", priority: 0.3 },
    ...["offer", "cookies", "consent"].map((slug) => ({
      url: `${base}/documents/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
    ...plans.map((plan) => ({
      url: `${base}/plans/${plan.id}`,
      lastModified: plan.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...services.map((service) => ({
      url: `${base}/services/${service.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
