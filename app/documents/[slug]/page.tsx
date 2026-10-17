import { notFound } from "next/navigation";
import { LegalDocument } from "@/components/legal-document";
import {
  getLegalDocument,
  LEGAL_SLUGS,
  type LegalSlug,
} from "@/lib/legal-store";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { slug } = await params;
  const { version } = await searchParams;
  return {
    title: "Документы — TRIOZ Business",
    alternates: { canonical: `/documents/${slug}` },
    robots: { index: !version, follow: true },
  };
}
export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { slug } = await params;
  if (!LEGAL_SLUGS.includes(slug as LegalSlug)) notFound();
  const { version } = await searchParams;
  const doc = await getLegalDocument(slug as LegalSlug, version);
  if (!doc) notFound();
  return <LegalDocument document={doc} />;
}
