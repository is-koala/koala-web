import Link from "next/link";

import { legalDocuments, type LegalDocumentSlug } from "@/content/legal/documents";

export function LegalDocument({ slug, frozen = false }: { slug: LegalDocumentSlug; frozen?: boolean }) {
  const document = legalDocuments[slug];
  return (
    <article className="legal-document">
      <p className="legal-meta">Sürüm {document.version} · Yürürlük tarihi: {document.effectiveDate}</p>
      <document.Component />
      {!frozen && <p><Link className="text-link" href={`/${slug}/v/${document.version}`}>Önceki sürümler: 1.0</Link></p>}
    </article>
  );
}
