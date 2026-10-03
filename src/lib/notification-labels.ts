/**
 * Bildirim kategorisi ve kanal değerleri ile Türkçe etiketleri.
 *
 * Bağımlılıksız bir yaprak: kabuktaki tercih formu da herkese açık çıkış
 * sayfası da (`/bildirim-tercihleri/cikis`) buradan okur; çıkış sayfası
 * `profile.ts`'in geri kalanını paketine taşımasın.
 */

/**
 * Backend `NotificationCategory` enum'u, aynı sırayla. Liste backend'den geride
 * kaldığında tercih formu bilmediği satırı gönderiyor ve action kaydın
 * tamamını reddediyordu (is-koala/koala-web#198); sözleşme testi
 * (`notification-labels.contract.test.ts`) listeyi canlı OpenAPI parçasına
 * bağlıyor.
 */
export const notificationCategoryValues = [
  "ACCOUNT_SECURITY",
  "APPLICATION_UPDATES",
  "IDENTITY_VERIFICATION",
  "MARKETINGS",
  "COMPANY_UPDATES",
  "JOB_ALERTS",
  "MESSAGES",
  "NEWSLETTER",
  "TRANSPORT",
] as const;

export type NotificationCategory = (typeof notificationCategoryValues)[number];

/** Backend `NotificationChannel` enum'u, aynı sırayla. */
export const notificationChannelValues = ["EMAIL", "SMS", "PUSH", "IN_APP"] as const;

export type NotificationChannel = (typeof notificationChannelValues)[number];

export const notificationCategoryLabels = {
  ACCOUNT_SECURITY: "Hesap güvenliği",
  APPLICATION_UPDATES: "Başvuru güncellemeleri",
  IDENTITY_VERIFICATION: "Kimlik doğrulama",
  MARKETINGS: "Kampanya ve duyurular",
  COMPANY_UPDATES: "Şirket güncellemeleri",
  JOB_ALERTS: "İş alarmları",
  MESSAGES: "Mesajlar",
  NEWSLETTER: "Bülten",
  TRANSPORT: "Ulaşım",
} satisfies Record<NotificationCategory, string>;

export function notificationCategoryLabel(category: string): string {
  return Object.hasOwn(notificationCategoryLabels, category)
    ? notificationCategoryLabels[category as NotificationCategory]
    : "Diğer bildirim";
}

export const notificationChannelLabels = {
  EMAIL: "E-posta",
  SMS: "SMS",
  PUSH: "Anlık bildirim",
  IN_APP: "Uygulama içi",
} satisfies Record<NotificationChannel, string>;

/** Backend'den gelen ham kanal adı; bilinmeyen değer etikete dönüşmez. */
export function notificationChannelLabel(channel: string): string {
  return Object.hasOwn(notificationChannelLabels, channel)
    ? notificationChannelLabels[channel as NotificationChannel]
    : "Diğer kanal";
}

export function isNotificationCategory(value: unknown): value is NotificationCategory {
  return typeof value === "string" && (notificationCategoryValues as readonly string[]).includes(value);
}

export function isNotificationChannel(value: unknown): value is NotificationChannel {
  return typeof value === "string" && (notificationChannelValues as readonly string[]).includes(value);
}
