/**
 * E-posta bağlantısını açan cihazın ne olduğunu belirler.
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

/** Uygulamayı açmayı deneyen derin bağlantı. */
export function deepLink(path: string, token?: string): string {
  const scheme = process.env.NEXT_PUBLIC_APP_SCHEME ?? "koala";
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${scheme}://${path}${query}`;
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
