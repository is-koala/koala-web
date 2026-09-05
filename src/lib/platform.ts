/**
 * E-posta bağlantısını açan cihazın ne olduğunu belirler ve uygulamanın
 * gerçekten kabul edeceği derin bağlantıyı üretir.
 *
 * Bu, sitenin asıl işi: aynı bağlantı mobilde uygulamaya, uygulama yoksa
 * mağazaya, masaüstünde ise web formuna gitmeli. Karar sunucuda veriliyor ki
 * kullanıcı bir kare bile yanlış ekran görmesin.
 */
export type Platform = "ios" | "android" | "desktop";

export function detectPlatform(userAgent: string | null): Platform {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

/**
 * Uygulamanın tanıdığı derin bağlantı host'ları.
 *
 * Bu liste keyfi değil: `koala-mobile/lib/product/router/app_link_destination.dart`
 * yalnız bu üç host'u tanıyor ve başka her şeyi sessizce reddediyor. Web
 * rotalarımız Türkçe (`/hesap-dogrula`) ama derin bağlantı host'u İngilizce
 * olmak zorunda — ikisi ayrı sözleşme.
 */
const APP_HOSTS = {
  completeRegistration: "complete-registration",
  resetPassword: "reset-password",
  paymentResult: "payment-result",
} as const;

export type AppHost = (typeof APP_HOSTS)[keyof typeof APP_HOSTS];

/** Web rotasından uygulamanın anlayacağı host'a eşleme. */
export const appHostForRoute: Record<string, AppHost | null> = {
  "hesap-dogrula": APP_HOSTS.completeRegistration,
  "sifre-belirle": APP_HOSTS.completeRegistration,
  "sifre-sifirla": APP_HOSTS.resetPassword,
  // Uygulamada e-posta onayı için bir host YOK; bu akış web'de tamamlanmalı.
  "eposta-onayla": null,
};

/**
 * Uygulamayı açmayı deneyen derin bağlantı.
 *
 * Üç katı kısıt var, üçü de `app_link_destination.dart:7-10` ve `:46-50`
 * tarafından zorlanıyor ve ihlal edilirse bağlantı **sessizce** reddedilir:
 *   1. Path boş olmalı — `koala://host?...`, asla `koala://host/yol`
 *   2. Kullanıcı bilgisi, port ve fragment olmamalı
 *   3. **Tam bir** query parametresi olmalı — ikinci bir parametre eklemek
 *      (ör. `&source=web`) bağlantıyı geçersiz kılar
 */
export function deepLink(host: AppHost, token: string): string {
  const scheme = process.env.NEXT_PUBLIC_APP_SCHEME ?? "koala";
  return `${scheme}://${host}?token=${encodeURIComponent(token)}`;
}

/** Token taşımayan sade açılış: uygulama açılır, özel bir ekrana gitmez. */
export function openAppLink(): string {
  const scheme = process.env.NEXT_PUBLIC_APP_SCHEME ?? "koala";
  return `${scheme}://`;
}

/** Uygulama kurulu değilse gidilecek mağaza. */
export function storeLink(platform: Platform): string | null {
  if (platform === "ios") {
    const id = process.env.NEXT_PUBLIC_IOS_APP_ID;
    return id ? `https://apps.apple.com/tr/app/id${id}` : null;
  }
  if (platform === "android") {
    const pkg = process.env.NEXT_PUBLIC_ANDROID_PACKAGE;
    return pkg ? `https://play.google.com/store/apps/details?id=${pkg}` : null;
  }
  return null;
}
