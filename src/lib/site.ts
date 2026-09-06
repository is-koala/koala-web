import { legalCatalog } from "@/content/legal/catalog";

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

/**
 * Oturum gerektiren sayfalardan dönülecek giriş adresi. Sayfanın kendisi
 * #15 ile geliyor; oturum katmanı hedefi buradan okur ki iki yerde
 * ayrışmasın.
 */
export const loginPath = "/giris";

/**
 * Kayıt tamamlandıktan sonra kullanıcının bırakılacağı yer.
 *
 * Hâlâ `/`, ama artık gidilecek bir yer olmadığı için değil: `/isveren` ve
 * `/panel` kabukları is-koala/koala-web#25 ile açıldı. Bekleyen şey **hangisi**
 * sorusunun cevabı. Üç seçenek de hedefin `isEmployer`'a bakmasını istiyor, ama
 * birinde bu aynı zamanda `/isveren`'i iş arayana tamamen kapatan sert bir kapı
 * anlamına geliyor; karar verilmeden yazılacak bir hedef, o kapıyı da sessizce
 * seçmiş olurdu. Karar #25'e yorum olarak düşecek ve değişecek tek satır burası.
 */
export const postRegistrationPath = "/";

export const marketingNav = [
  { href: "/is-arayanlar", label: "İş Arayanlar" },
  { href: "/isverenler", label: "İşverenler" },
  { href: "/nasil-calisir", label: "Nasıl Çalışır" },
  { href: "/sss", label: "SSS" },
] as const;

export const legalNav = Object.entries(legalCatalog).map(([slug, document]) => ({
  href: `/${slug}`,
  label: document.title,
}));
