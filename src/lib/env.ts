const allowedSchemes = new Set(["koala-dev", "koala-staging", "koala"]);

function required(name: "NEXT_PUBLIC_SITE_URL" | "NEXT_PUBLIC_APP_URL_SCHEME") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Zorunlu ortam değişkeni eksik: ${name}`);
  }
  return value;
}

export function publicEnvironment() {
  const siteUrl = required("NEXT_PUBLIC_SITE_URL");
  const appUrlScheme = required("NEXT_PUBLIC_APP_URL_SCHEME");
  try {
    new URL(siteUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL geçerli bir mutlak URL olmalı.");
  }
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
