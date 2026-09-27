import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/enter", "/admin", "/dashboard", "/login", "/api/"] },
    sitemap: "https://trioz.ru/sitemap.xml",
  };
}
