import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/uploads/"],
      disallow: [
        "/enter",
        "/admin",
        "/dashboard",
        "/login",
        "/account",
        "/api/",
      ],
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
