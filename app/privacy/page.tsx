import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { privacyDocument } from "@/lib/legal-documents";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Политика обработки персональных данных — TRIOZ Business",
  description: "Данные заявок, цели обработки, почтовые уведомления и обращения по персональным данным в TRIOZ Business.",
  alternates: { canonical: "/privacy" },
  openGraph: { title: "Политика обработки персональных данных", url: siteUrl("/privacy") },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return <LegalDocument document={privacyDocument} />;
}
