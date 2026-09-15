import type { ErrorCatalog } from "@/lib/error-presentation";

/**
 * Mesajlaşma kapısının iki reddi (is-koala/koala-backend#257) ve şikâyet
 * çakışması.
 *
 * `forbidden` aile metni ("Bu işlem için yetkin yok") ilkinde yanlış bir
 * sebep söylerdi: yetki değil ödeme eksik, ve işverenin atacağı somut adım
 * var. İkincisi `conflict` ailesinde; "sayfayı yenileyip yeniden dene"
 * burada işe yaramaz — pencere kapandı ve yeniden açan bir uç yok. Atama
 * ekranları aynı iki hâli `messagingAvailableReason` ile **önden**
 * gösteriyor (`MessagingGate`); bu metinler kapı bayatladığında, yani
 * düğme çizildikten sonra ödeme iade edildiğinde ya da pencere o sırada
 * kapandığında görünür.
 */
export const messagingErrors: ErrorCatalog = {
  MESSAGING_PAYMENT_REQUIRED: {
    title: "Mesajlaşma henüz açılmadı",
    message: "Mesajlaşma, işveren ödemeyi tamamladığında açılır.",
    action: "none",
  },
  MESSAGING_WINDOW_CLOSED: {
    title: "Sohbet kapandı",
    message:
      "Bu atamanın mesajlaşma penceresi kapandı: atama iptal ya da iade edilmiş veya iş bitiminin üzerinden yedi gün geçmiş olabilir. Geçmişi okumaya devam edebilirsin.",
    action: "none",
  },
  REPORT_IDEMPOTENCY_CONFLICT: {
    title: "Bu mesaj için farklı bir şikâyetin var",
    message:
      "Bu mesajı daha önce farklı bilgilerle şikâyet ettin. Mevcut şikâyetin değiştirilemez; moderasyon ekibi onu inceleyecek.",
    action: "none",
  },
};
