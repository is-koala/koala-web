import type { ComponentType } from "react";

import { legalCatalog, type LegalDocumentSlug } from "./catalog";
import CookiePolicy from "./cerez-politikasi/1.0.mdx";
import PrivacyPolicy from "./gizlilik-politikasi/1.0.mdx";
import Terms from "./kullanim-kosullari/1.0.mdx";
import KvkkNotice from "./kvkk-aydinlatma/1.0.mdx";
import DistanceContract from "./mesafeli-hizmet-sozlesmesi/1.0.mdx";

export type { LegalDocumentSlug } from "./catalog";

const legalComponents = {
  "kullanim-kosullari": Terms,
  "gizlilik-politikasi": PrivacyPolicy,
  "mesafeli-hizmet-sozlesmesi": DistanceContract,
  "kvkk-aydinlatma": KvkkNotice,
  "cerez-politikasi": CookiePolicy,
} satisfies Record<LegalDocumentSlug, ComponentType>;

export const legalDocuments = mapDocuments(legalCatalog, legalComponents);

function mapDocuments<Slug extends string>(
  catalog: Record<Slug, { title: string; version: "1.0"; effectiveDate: string }>,
  components: Record<Slug, ComponentType>,
) {
  return Object.fromEntries(
    (Object.keys(catalog) as Slug[]).map((slug) => [
      slug,
      { ...catalog[slug], Component: components[slug] },
    ]),
  ) as Record<Slug, { title: string; version: "1.0"; effectiveDate: string; Component: ComponentType }>;
}
