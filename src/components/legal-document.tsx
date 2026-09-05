import Link from "next/link";

import {
  getLegalDocumentVersion,
  legalDocuments,
  legalDocumentVersions,
  type LegalDocumentSlug,
} from "@/content/legal/documents";

export function LegalDocument({
  slug,
  version,
  frozen = false,
}: {
  slug: LegalDocumentSlug;
  version?: string;
  frozen?: boolean;
}) {
  const document = version
    ? getLegalDocumentVersion(slug, version)
    : legalDocuments[slug];
  if (!document) return null;
  const versions = Object.keys(legalDocumentVersions[slug]).sort();
  return (
    <article className="legal-document">
      <p className="legal-meta">Sürüm {document.version} · Yürürlük tarihi: {document.effectiveDate}</p>
      <document.Component />
      {!frozen && (
        <p>
          Sürümler:{" "}
          {versions.map((availableVersion, index) => (
            <span key={availableVersion}>
              {index > 0 && " · "}
              <Link className="text-link" href={`/${slug}/v/${availableVersion}`}>
                {availableVersion}
              </Link>
            </span>
          ))}
        </p>
      )}
    </article>
  );
}
