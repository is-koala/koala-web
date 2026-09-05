/**
 * Sitenin tek doğruluk kaynağı olan sabitler.
 *
 * Rota adları e-postalara gömülecek: değiştirmek daha önce gönderilmiş
 * bağlantıları kırar. Yeni rota eklemek serbest, mevcut olanı yeniden
 * adlandırmak değil.
 */
export const site = {
  name: "Koala",
  domain: "iskoala.com",
  description:
    "Günlük ve kısa süreli işler için işvereni ve iş arayanı buluşturan platform.",
} as const;

export const marketingNav = [
  { href: "/is-arayanlar", label: "İş Arayanlar" },
  { href: "/isverenler", label: "İşverenler" },
  { href: "/nasil-calisir", label: "Nasıl Çalışır" },
  { href: "/sss", label: "SSS" },
] as const;

export const legalNav = [
  { href: "/kullanim-kosullari", label: "Kullanım Koşulları" },
  { href: "/gizlilik-politikasi", label: "Gizlilik Politikası" },
  { href: "/kvkk-aydinlatma", label: "KVKK Aydınlatma Metni" },
  { href: "/cerez-politikasi", label: "Çerez Politikası" },
] as const;
