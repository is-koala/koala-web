/**
 * Bildirim kategorisi ve kanal değerleri ile Türkçe etiketleri.
 *
 * Bağımlılıksız bir yaprak: kabuktaki tercih formu da herkese açık çıkış
 * sayfası da (`/bildirim-tercihleri/cikis`) buradan okur; çıkış sayfası
 * `profile.ts`'in geri kalanını paketine taşımasın.
 */

export const notificationCategoryValues = [
  "ACCOUNT_SECURITY",
  "APPLICATION_UPDATES",
  "IDENTITY_VERIFICATION",
  "MARKETINGS",
  "COMPANY_UPDATES",
  "JOB_ALERTS",
  "NEWSLETTER",
] as const;

export type NotificationCategory = (typeof notificationCategoryValues)[number];

export const notificationChannelValues = ["EMAIL", "PUSH", "IN_APP"] as const;

export type NotificationChannel = (typeof notificationChannelValues)[number];

export const notificationCategoryLabels = {
  ACCOUNT_SECURITY: "Hesap güvenliği",
  APPLICATION_UPDATES: "Başvuru güncellemeleri",
  IDENTITY_VERIFICATION: "Kimlik doğrulama",
  MARKETINGS: "Kampanya ve duyurular",
  COMPANY_UPDATES: "Şirket güncellemeleri",
  JOB_ALERTS: "İş alarmları",
  NEWSLETTER: "Bülten",
} satisfies Record<NotificationCategory, string>;

export function notificationCategoryLabel(category: string): string {
  return Object.hasOwn(notificationCategoryLabels, category)
    ? notificationCategoryLabels[category as NotificationCategory]
    : "Diğer bildirim";
}

export const notificationChannelLabels = {
  EMAIL: "E-posta",
  PUSH: "Anlık bildirim",
  IN_APP: "Uygulama içi",
} satisfies Record<NotificationChannel, string>;

/** Backend'den gelen ham kanal adı; bilinmeyen değer etikete dönüşmez. */
export function notificationChannelLabel(channel: string): string {
  return Object.hasOwn(notificationChannelLabels, channel)
    ? notificationChannelLabels[channel as NotificationChannel]
    : "Diğer kanal";
}
