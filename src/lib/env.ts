const allowedSchemes = new Set(["koala-dev", "koala-staging", "koala"]);

/**
 * Ortam doğrulaması hem public hem sunucu değişkenleri için aynı Türkçe
 * hatayı vermeli; eksik değişkenin adı hata metninde geçtiği için sorun
 * loglardan tek okumada anlaşılır.
 */
export function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Zorunlu ortam değişkeni eksik: ${name}`);
  }
  return value;
}

export function assertAbsoluteUrl(value: string, name: string) {
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} geçerli bir mutlak URL olmalı.`);
  }
}

export function publicEnvironment() {
  const siteUrl = requiredEnvironmentValue("NEXT_PUBLIC_SITE_URL");
  const appUrlScheme = requiredEnvironmentValue("NEXT_PUBLIC_APP_URL_SCHEME");
  assertAbsoluteUrl(siteUrl, "NEXT_PUBLIC_SITE_URL");
  if (!allowedSchemes.has(appUrlScheme)) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL_SCHEME koala-dev, koala-staging veya koala olmalı.",
    );
  }
  return {
    siteUrl,
    appUrlScheme,
    androidPackageId: process.env.NEXT_PUBLIC_ANDROID_PACKAGE_ID?.trim() || undefined,
    iosAppStoreId: process.env.NEXT_PUBLIC_IOS_APP_STORE_ID?.trim() || undefined,
  };
}
