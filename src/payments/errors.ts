import type { ErrorCatalog } from "@/lib/error-presentation";

/** İşveren ödemesinin (emanet tahsilatı) redleri; hepsi "ödeme alınmadı" der. */
export const paymentErrors: ErrorCatalog = {
  JOB_ASSIGNMENT_EMPLOYER_IDENTITY_NOT_VERIFIED: {
    title: "Kimlik bilgilerin eksik",
    message:
      "Ödeme alınmadı. Kimlik doğrulamanı ve kimlik numaranı tamamladıktan sonra yeniden deneyebilirsin.",
    action: "none",
  },
  JOB_ASSIGNMENT_ADDRESS_NOT_PROVIDED_FOR_EMPLOYER: {
    title: "Fatura adresi eksik",
    message: "Ödeme alınmadı. Fatura adresini tamamladıktan sonra yeniden deneyebilirsin.",
    action: "none",
  },
  JOB_ASSIGNMENT_NOT_READY_FOR_PAYMENT: {
    title: "Bu atama için ödeme başlatılamıyor",
    message:
      "Atamanın güncel durumunu kontrol et. Tahsil edilmiş veya işçi tarafından henüz onaylanmamış olabilir.",
    action: "retry",
  },
  PAYMENT_PROVIDER_UNAVAILABLE: {
    title: "Ödeme sağlayıcısına ulaşılamadı",
    message: "Kartından ödeme alınmadı. Biraz sonra yeniden deneyebilirsin.",
    action: "retry",
  },
  PAYMENT_PROVIDER_REJECTED: {
    title: "Ödeme başlatılamadı",
    message: "Kartından ödeme alınmadı. Biraz sonra yeniden deneyebilirsin.",
    action: "retry",
  },
  PAYMENT_PAGE_URL_REJECTED: {
    title: "Güvenli ödeme sayfası açılamadı",
    message: "Yönlendirme güvenlik kontrolünden geçmedi. Kartından ödeme alınmadı.",
    action: "retry",
  },
  PAYMENT_ATTEMPT_IN_PROGRESS: {
    title: "Ödeme sonucu bekleniyor",
    message: "Devam eden ödeme denemesi kesinleşmeden yeni bir ödeme başlatılamaz.",
    action: "none",
  },
};
