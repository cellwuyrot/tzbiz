import type { MetadataRoute } from "next";
import { getPublishedServices } from "@/lib/service-content";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://trioz.ru";
  const services = await getPublishedServices().catch(() => []);
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...services.map((service) => ({
      url: `${base}/services/${service.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
