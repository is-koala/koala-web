import { legalRegistry, type AgreementType } from "@/content/legal/registry";

/** `AgreementVersionDto`; kullanılmayan alanlar taşınmıyor. */
export type Agreement = {
  id: string;
  type: AgreementType;
  version: string;
  mandatory: boolean;
  /** Backend'in işaret ettiği adres; bugün boş ya da yanlış olabilir. */
  contentUrl: string | null;
};

/** `ConsentDecisionDto`. */
export type ConsentDecision = {
  agreementVersionId: string;
  granted: boolean;
};

/**
 * Her sözleşme için bir karar üretir.
 *
 * Reddedilenler listeden düşmez, `granted: false` ile gider: backend
 * "sormadık" ile "sorduk reddetti" ayrımını denetim için tutuyor
 * (`LegalController` `/legal/consents/me`).
 */
export function consentDecisions(
  agreements: readonly Agreement[],
  grantedIds: readonly string[],
): ConsentDecision[] {
  return agreements.map((agreement) => ({
    agreementVersionId: agreement.id,
    granted: grantedIds.includes(agreement.id),
  }));
}

/**
 * Onaylanmadan kaydın tamamlanamayacağı sözleşmeler. Backend aynı denetimi
 * `LegalManager.assertMandatoryConsentsGranted` ile yapıp 400 döner; istemci
 * kullanıcıyı oraya kadar götürmeden durdurur.
 */
export function missingMandatoryConsents(
  agreements: readonly Agreement[],
  grantedIds: readonly string[],
): Agreement[] {
  return agreements.filter(
    (agreement) => agreement.mandatory && !grantedIds.includes(agreement.id),
  );
}

/**
 * Onay kutusundaki metnin gideceği adres.
 *
 * Sitenin kendi sürümlü yasal sayfası esas alınır: `AGENTS.md` bu sayfaların
 * backend'deki `contentUrl` boşluğunu kapattığını söylüyor, yani o alan boş
 * ya da yanlış gelebilir. Beş `AgreementType` için de yerel karşılık var
 * (`src/content/legal/registry.ts`).
 *
 * Sürüm eşleşmesi şart: kullanıcı onayladığı metni okumalı. Backend bir
 * sözleşmeyi yeni sürüme aldığında yereldeki eski sürüme bağlamak, rıza
 * kaydının işaret ettiğinden başka bir metni göstermek olurdu; o durumda
 * backend'in kendi adresine, o da yoksa hiçbir yere bağlanmaz.
 */
export function agreementLink(agreement: Agreement): string | null {
  const local = legalRegistry[agreement.type];
  if (local && local.version === agreement.version) return local.versionedUrl;
  return agreement.contentUrl ?? null;
}

/** Onay kutusunda görünen ad; yasal kayıt defteriyle aynı kaynaktan gelir. */
export function agreementTitle(agreement: Agreement): string {
  return legalRegistry[agreement.type]?.title ?? "Sözleşme";
}
