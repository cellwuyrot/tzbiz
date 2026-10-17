import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { DOCUMENT_LABELS } from "@/lib/legal-store";
export const metadata = {
  title: "Документы",
  alternates: { canonical: "/documents" },
};
export default function Documents() {
  return (
    <main className="min-h-screen">
      <SiteHeader basePath="/" />
      <section className="site-shell space-y-6 py-12">
        <h1 className="type-h2">Документы</h1>
        <nav className="grid gap-4">
          {Object.entries(DOCUMENT_LABELS).map(([slug, title]) => (
            <Link
              className="panel p-5 text-accent type-body"
              key={slug}
              href={
                slug === "agreement" || slug === "privacy"
                  ? `/${slug}`
                  : `/documents/${slug}`
              }
            >
              {title}
            </Link>
          ))}
        </nav>
        <Link className="button-secondary" href="/payment">
          Продавец, оплата и возврат
        </Link>
      </section>
    </main>
  );
}
