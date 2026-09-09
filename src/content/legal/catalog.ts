export const legalCatalog = {
  "kullanim-kosullari": legalDocument("Kullanım Koşulları", "1.0"),
  "gizlilik-politikasi": legalDocument("Gizlilik Politikası", "1.0"),
  "mesafeli-hizmet-sozlesmesi": legalDocument("Mesafeli Hizmet Sözleşmesi", "1.0"),
  "kvkk-aydinlatma": legalDocument("KVKK Aydınlatma Metni", "1.0"),
  "cerez-politikasi": legalDocument("Çerez Politikası", "1.1"),
} as const;

export type LegalDocumentSlug = keyof typeof legalCatalog;
export type LegalDocumentVersion = "1.0" | "1.1";

export function isLegalDocumentSlug(slug: string): slug is LegalDocumentSlug {
  return Object.hasOwn(legalCatalog, slug);
}

function legalDocument<Version extends LegalDocumentVersion>(
  title: string,
  version: Version,
) {
  return {
    title,
    version,
    effectiveDate: "Hukuk incelemesi sonrası belirlenecek",
  };
}
