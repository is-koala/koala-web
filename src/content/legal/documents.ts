import type { ComponentType } from "react";

import {
  legalCatalog,
  type LegalDocumentSlug,
  type LegalDocumentVersion,
} from "./catalog";
import CookiePolicyV10 from "./cerez-politikasi/1.0.mdx";
import CookiePolicyV11 from "./cerez-politikasi/1.1.mdx";
import PrivacyPolicy from "./gizlilik-politikasi/1.0.mdx";
import Terms from "./kullanim-kosullari/1.0.mdx";
import KvkkNotice from "./kvkk-aydinlatma/1.0.mdx";
import DistanceContract from "./mesafeli-hizmet-sozlesmesi/1.0.mdx";

export type { LegalDocumentSlug } from "./catalog";

export type LegalDocumentRecord = {
  title: string;
  version: LegalDocumentVersion;
  effectiveDate: string;
  Component: ComponentType;
};

const legalVersionComponents = {
  "kullanim-kosullari": { "1.0": Terms },
  "gizlilik-politikasi": { "1.0": PrivacyPolicy },
  "mesafeli-hizmet-sozlesmesi": { "1.0": DistanceContract },
  "kvkk-aydinlatma": { "1.0": KvkkNotice },
  "cerez-politikasi": { "1.0": CookiePolicyV10, "1.1": CookiePolicyV11 },
} satisfies Record<
  LegalDocumentSlug,
  Partial<Record<LegalDocumentVersion, ComponentType>>
>;

export const legalDocumentVersions = Object.fromEntries(
  (Object.keys(legalCatalog) as LegalDocumentSlug[]).map((slug) => [
    slug,
    Object.fromEntries(
      Object.entries(legalVersionComponents[slug]).map(([version, Component]) => [
        version,
        { ...legalCatalog[slug], version, Component },
      ]),
    ) as Partial<Record<LegalDocumentVersion, LegalDocumentRecord>>,
  ]),
) as Record<
  LegalDocumentSlug,
  Partial<Record<LegalDocumentVersion, LegalDocumentRecord>>
>;

export const legalDocuments = Object.fromEntries(
  (Object.keys(legalCatalog) as LegalDocumentSlug[]).map((slug) => {
    const current = legalCatalog[slug];
    return [slug, legalDocumentVersions[slug][current.version]];
  }),
) as Record<LegalDocumentSlug, LegalDocumentRecord>;

export function getLegalDocumentVersion(
  slug: LegalDocumentSlug,
  version: string,
): LegalDocumentRecord | undefined {
  return legalDocumentVersions[slug][version as LegalDocumentVersion];
}
