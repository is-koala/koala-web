export type Platform = "ios" | "android" | "desktop";

export type AppDestination =
  | "hesap-dogrula"
  | "sifre-belirle"
  | "sifre-sifirla"
  | "eposta-onayla"
  | "payment-result";

type StoreConfig = {
  iosAppStoreId?: string;
  androidPackageId?: string;
};

export function resolvePlatform(userAgent: string | null): Platform {
  const normalized = userAgent?.toLocaleLowerCase("en-US") ?? "";
  if (/iphone|ipad|ipod/.test(normalized)) return "ios";
  if (normalized.includes("android")) return "android";
  return "desktop";
}

export function buildAppLink({
  destination,
  token,
  scheme,
}: {
  destination: AppDestination;
  token: string;
  scheme: string;
}): string {
  return `${scheme}://${destination}?token=${encodeURIComponent(token)}`;
}

export function buildPaymentResultLink({
  status,
  assignmentId,
  scheme,
}: {
  status: "success" | "failed";
  assignmentId: string;
  scheme: string;
}): string {
  const query = new URLSearchParams({ status, assignmentId });
  return `${scheme}://payment-result?${query.toString()}`;
}

export function buildOpenAppLink(scheme: string): string {
  return `${scheme}://`;
}

export function buildAndroidIntentUrl({
  destination,
  token,
  scheme,
  packageId,
  fallbackUrl,
}: {
  destination: AppDestination;
  token: string;
  scheme: string;
  packageId: string;
  fallbackUrl: string;
}): string {
  return `intent://${destination}?token=${encodeURIComponent(token)}#Intent;scheme=${scheme};package=${packageId};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}

export function buildAndroidPaymentResultIntentUrl({
  status,
  assignmentId,
  scheme,
  packageId,
  fallbackUrl,
}: {
  status: "success" | "failed";
  assignmentId: string;
  scheme: string;
  packageId: string;
  fallbackUrl: string;
}): string {
  const query = new URLSearchParams({ status, assignmentId });
  return `intent://payment-result?${query.toString()}#Intent;scheme=${scheme};package=${packageId};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}

export function storeUrl(
  platform: Platform,
  config: StoreConfig,
): string | null {
  if (platform === "ios" && config.iosAppStoreId) {
    return `https://apps.apple.com/tr/app/id${config.iosAppStoreId}`;
  }
  if (platform === "android" && config.androidPackageId) {
    return `https://play.google.com/store/apps/details?id=${config.androidPackageId}`;
  }
  return null;
}
