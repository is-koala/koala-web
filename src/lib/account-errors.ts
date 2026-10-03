import type { ErrorCatalog } from "./error-presentation";

/** Hesap ayarlarının (`/panel/hesap`, `/isveren/hesap`) redleri. */
export const accountErrors: ErrorCatalog = {
  // `IysMessages.VERIFIED_RECIPIENT_REQUIRED`: ticari bir kategoriyi SMS ya da
  // e-postayla açmak doğrulanmış alıcı istiyor; backend kaydın tamamını geri
  // alıyor. Doğrulamanın yeri formun yanında bağlantıyla gösteriliyor.
  IYS_VERIFIED_RECIPIENT_REQUIRED: {
    title: "Önce iletişim bilgini doğrula",
    message:
      "Kampanya ve bülten bildirimlerini SMS ya da e-postayla açmak için telefon numaranı ya da e-posta adresini doğrulaman gerekiyor. Tercihlerin kaydedilmedi.",
    action: "none",
  },
  LEGAL_DELETION_ALREADY_REQUESTED: {
    title: "Silme talebin zaten var",
    message: "Bekleyen talebinin güncel durumunu görmek için sayfayı yenileyebilirsin.",
    action: "retry",
  },
};
