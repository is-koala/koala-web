import { notFound } from "next/navigation";

import { LegalDocument } from "@/components/legal-document";
import { MainContent } from "@/components/main-content";
import { isLegalDocumentSlug } from "@/content/legal/catalog";
import {
  getLegalDocumentVersion,
  legalDocumentVersions,
} from "@/content/legal/documents";
import { pageMetadata } from "@/lib/metadata";

type VersionedLegalPageProps = {
  params: Promise<{ slug: string; version: string }>;
};

export function generateStaticParams() {
  return Object.entries(legalDocumentVersions).flatMap(([slug, versions]) =>
    Object.keys(versions).map((version) => ({ slug, version })),
  );
}

function resolveLegalDocument(slug: string, version: string) {
  if (!isLegalDocumentSlug(slug)) notFound();
  const document = getLegalDocumentVersion(slug, version);
  if (!document) notFound();
  return { document, slug };
}

export async function generateMetadata({ params }: VersionedLegalPageProps) {
  const { slug, version } = await params;
  const { document } = resolveLegalDocument(slug, version);
  return pageMetadata(
    `${document.title} — Sürüm ${version}`,
    `${document.title} dondurulmuş sürüm ${version}.`,
    `/${slug}/v/${version}`,
  );
}

export default async function VersionedLegalPage({
  params,
}: VersionedLegalPageProps) {
  const { slug, version } = await params;
  const legalDocument = resolveLegalDocument(slug, version);
  return (
    <MainContent className="legal-shell">
      <LegalDocument slug={legalDocument.slug} version={version} frozen />
    </MainContent>
  );
}
