import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { getLegalDocument } from "@/lib/legal-store";
export const dynamic = "force-dynamic";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Политика обработки персональных данных — TRIOZ Business",
  description:
    "Данные заявок, цели обработки, почтовые уведомления и обращения по персональным данным в TRIOZ Business.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Политика обработки персональных данных",
    url: siteUrl("/privacy"),
  },
  robots: { index: true, follow: true },
};

export default async function PrivacyPage() {
  const document = await getLegalDocument("privacy");
  return <LegalDocument document={document!} />;
}
