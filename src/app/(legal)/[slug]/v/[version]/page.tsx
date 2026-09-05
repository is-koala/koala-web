import { notFound } from "next/navigation";

import { LegalDocument } from "@/components/legal-document";
import { legalDocuments, type LegalDocumentSlug } from "@/content/legal/documents";
import { pageMetadata } from "@/lib/metadata";

export function generateStaticParams() {
  return Object.entries(legalDocuments).map(([slug, document]) => ({
    slug,
    version: document.version,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; version: string }> }) {
  const { slug, version } = await params;
  const document = legalDocuments[slug as LegalDocumentSlug];
  if (!document || version !== document.version) return {};
  return pageMetadata(`${document.title} — Sürüm ${version}`, `${document.title} dondurulmuş sürüm ${version}.`, `/${slug}/v/${version}`);
}

export default async function VersionedLegalPage({ params }: { params: Promise<{ slug: string; version: string }> }) {
  const { slug, version } = await params;
  const document = legalDocuments[slug as LegalDocumentSlug];
  if (!document || version !== document.version) notFound();
  return <main className="legal-shell"><LegalDocument slug={slug as LegalDocumentSlug} frozen /></main>;
}
