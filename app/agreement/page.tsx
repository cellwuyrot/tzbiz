import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { getLegalDocument } from "@/lib/legal-store";
export const dynamic = "force-dynamic";
import { siteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Пользовательское соглашение — TRIOZ Business",
  description:
    "Порядок использования сайта TRIOZ Business, отправки заявок и доступа к клиентским проектам.",
  alternates: { canonical: "/agreement" },
  openGraph: {
    title: "Пользовательское соглашение",
    url: siteUrl("/agreement"),
  },
  robots: { index: true, follow: true },
};

export default async function AgreementPage() {
  const document = await getLegalDocument("agreement");
  return <LegalDocument document={document!} />;
}
