export type AgreementType =
  | "TERMS_OF_SERVICE"
  | "PRIVACY_POLICY"
  | "DISTANCE_SERVICE_CONTRACT"
  | "EXPLICIT_CONSENT"
  | "COMMERCIAL_MESSAGE";

export type LegalRoute = {
  title: string;
  slug: string;
  version: "1.0";
  currentUrl: string;
  versionedUrl: string;
};

export const legalRegistry = {
  TERMS_OF_SERVICE: legalRoute("kullanim-kosullari"),
  PRIVACY_POLICY: legalRoute("gizlilik-politikasi"),
  DISTANCE_SERVICE_CONTRACT: legalRoute(
    "mesafeli-hizmet-sozlesmesi",
  ),
  EXPLICIT_CONSENT: legalRoute("kvkk-aydinlatma", "acik-riza", "Açık Rıza"),
  COMMERCIAL_MESSAGE: legalRoute(
    "kvkk-aydinlatma",
    "ticari-ileti",
    "Ticari İleti İzni",
  ),
} satisfies Record<AgreementType, LegalRoute>;

function legalRoute(
  slug: LegalDocumentSlug,
  anchor?: string,
  agreementTitle?: string,
): LegalRoute {
  const document = legalCatalog[slug];
  const suffix = anchor ? `#${anchor}` : "";
  return {
    title: agreementTitle ?? document.title,
    slug,
    version: document.version,
    currentUrl: `/${slug}${suffix}`,
    versionedUrl: `/${slug}/v/${document.version}${suffix}`,
  };
}
import { legalCatalog, type LegalDocumentSlug } from "./catalog";
