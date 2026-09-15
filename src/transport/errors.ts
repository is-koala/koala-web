import type { ErrorCatalog } from "@/lib/error-presentation";

/**
 * Ulaşım planı ve koltuk seçiminin redleri (is-koala/koala-web#187,
 * backend 0.9.28).
 *
 * Kabuk kataloğuna (`@/lib/errors`) **birleştirilmiyor**, `identityRevealErrors`
 * ile aynı gerekçeyle: cümleler yalnız işverenin plan düzenleyicisinde ve
 * çalışanın ulaşım kartında okunuyor; iki bileşen onları önce buradan, sonra
 * kabuk kataloğundan seçiyor. `JOB_NOT_FOUND` katalogda değil (kabuk
 * kataloğunun genel cümlesi); servis/durak 404'ü ise kendi cümlesini taşıyor,
 * çünkü anlamı "yok" değil "başka bir cihazdan bu arada kaldırıldı" ve
 * düzenleyici taslağı sunucunun planıyla birleştirip yeniden kaydetmeyi istiyor.
 */
export const transportErrors: ErrorCatalog = {
  TRANSPORT_SHUTTLE_NOT_FOUND: {
    title: "Servis bu arada kaldırılmış",
    message:
      "Servis ya da durak bu arada kaldırılmış; plan güncellendi, kontrol edip yeniden kaydet.",
    action: "none",
  },
  TRANSPORT_STOP_NOT_FOUND: {
    title: "Durak bu arada kaldırılmış",
    message:
      "Servis ya da durak bu arada kaldırılmış; plan güncellendi, kontrol edip yeniden kaydet.",
    action: "none",
  },
  TRANSPORT_SHUTTLE_CAPACITY_BELOW_SEATS: {
    title: "Koltuk sayısı seçilmiş koltukların altında",
    message:
      "Bir servisin koltuk sayısı, o serviste zaten seçilmiş koltuk sayısının altına indirilemez. Sayıyı yükseltip yeniden kaydet.",
    action: "none",
  },
  TRANSPORT_SHUTTLE_DIRECTION_LOCKED: {
    title: "Servisin yönü değiştirilemez",
    message:
      "Var olan bir servisin yönü değiştirilemez. Servisi kaldırıp öbür yönde yeni bir servis aç.",
    action: "none",
  },
  TRANSPORT_SHUTTLE_DUPLICATE: {
    title: "Aynı servis iki kez listelendi",
    message: "Aynı servis listede iki kez yer alamaz. Sayfayı yenileyip yeniden dene.",
    action: "retry",
  },
  TRANSPORT_STOP_DUPLICATE: {
    title: "Aynı durak iki kez listelendi",
    message: "Aynı durak bir serviste iki kez yer alamaz. Sayfayı yenileyip yeniden dene.",
    action: "retry",
  },
  TRANSPORT_SHUTTLE_FULL: {
    title: "Servis dolu",
    message: "Bu serviste boş koltuk kalmadı. Başka bir servis seçebilirsin.",
    action: "none",
  },
  TRANSPORT_ASSIGNMENT_NOT_ACTIVE: {
    title: "Koltuk seçilemez",
    message: "Bu iş için koltuk seçimi kapalı; atama artık etkin değil.",
    action: "none",
  },
  TRANSPORT_SEAT_ALREADY_TAKEN: {
    title: "Seçim çakıştı",
    message: "Koltuk seçimin bu sırada başka bir cihazdan değişti. Güncel seçim gösteriliyor.",
    action: "none",
  },
};

/** `assignmentErrorMessage`'ın `own` sözlüğü: kod → cümle. */
export const transportErrorSentences: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(transportErrors).map(([code, entry]) => [code, entry.message]),
);
