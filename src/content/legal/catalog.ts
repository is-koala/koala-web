export const legalCatalog = {
  "kullanim-kosullari": legalDocument("Kullanım Koşulları"),
  "gizlilik-politikasi": legalDocument("Gizlilik Politikası"),
  "mesafeli-hizmet-sozlesmesi": legalDocument("Mesafeli Hizmet Sözleşmesi"),
  "kvkk-aydinlatma": legalDocument("KVKK Aydınlatma Metni"),
  "cerez-politikasi": legalDocument("Çerez Politikası"),
} as const;

export type LegalDocumentSlug = keyof typeof legalCatalog;

function legalDocument(title: string) {
  return {
    title,
    version: "1.0" as const,
    effectiveDate: "Hukuk incelemesi sonrası belirlenecek",
  };
}
