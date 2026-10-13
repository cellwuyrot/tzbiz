import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { agreementDocument } from "@/lib/legal-documents";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Пользовательское соглашение — TRIOZ Business",
  description: "Порядок использования сайта TRIOZ Business, отправки заявок и доступа к клиентским проектам.",
  alternates: { canonical: "/agreement" },
  openGraph: { title: "Пользовательское соглашение", url: siteUrl("/agreement") },
  robots: { index: true, follow: true },
};

export default function AgreementPage() {
  return <LegalDocument document={agreementDocument} />;
}
