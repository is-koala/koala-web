import { notFound } from "next/navigation";

import { LegalDocument } from "@/components/legal-document";
import {
  getLegalDocumentVersion,
  legalDocumentVersions,
  type LegalDocumentSlug,
} from "@/content/legal/documents";
import { pageMetadata } from "@/lib/metadata";

export function generateStaticParams() {
  return Object.entries(legalDocumentVersions).flatMap(([slug, versions]) =>
    Object.keys(versions).map((version) => ({ slug, version })),
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; version: string }> }) {
  const { slug, version } = await params;
  const document = getLegalDocumentVersion(slug as LegalDocumentSlug, version);
  if (!document) return {};
  return pageMetadata(`${document.title} — Sürüm ${version}`, `${document.title} dondurulmuş sürüm ${version}.`, `/${slug}/v/${version}`);
}

export default async function VersionedLegalPage({ params }: { params: Promise<{ slug: string; version: string }> }) {
  const { slug, version } = await params;
  const document = getLegalDocumentVersion(slug as LegalDocumentSlug, version);
  if (!document) notFound();
  return <main className="legal-shell"><LegalDocument slug={slug as LegalDocumentSlug} version={version} frozen /></main>;
}
