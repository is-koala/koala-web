import "server-only";

import { headers } from "next/headers";

import packageJson from "../../../package.json";

/**
 * `DeviceHints` (koala-backend): giriş ve yenileme isteğinde cihazın kendini
 * tanıttığı üç ipucu. Backend `null` olanı hiç yazmaz; üçü de boşsa
 * `DeviceHints.NONE` sayılır ve ad `User-Agent`'tan kurulur.
 */
export type DeviceHints = {
  /** Donanım modeli. Tarayıcı modelini söylemez; web her zaman boş gönderir. */
  model: string | null;
  os: string | null;
  appVersion: string | null;
};

/**
 * `X-Koala-App-Version` değeri: build anında dondurulan paket sürümü.
 *
 * `APP_VERSION` ortam değişkeni değil, bilerek: o değer sürüm kapısının
 * çalışma zamanı girdisi ve deploy ortamında ayrı ayarlanıyor; cihaz adına
 * giren sürüm ise kodun kendisiyle birlikte gitmeli ki "Koala 0.1.0 · web"
 * hangi kaynağın çalıştığını söylesin. `NEXT_PUBLIC_` değil: yalnız sunucu
 * okuyor, tarayıcı bundle'ına girmesi için bir neden yok.
 */
export const webAppVersion: string = packageJson.version;

/**
 * Tarayıcı `User-Agent`'ından işletim sistemi adı ve — güvenilir olduğu yerde —
 * sürümü: "iOS 18.1", "Android 14", "macOS", "Windows".
 *
 * Masaüstü sürümleri bilerek yok: Chrome ve Safari `Mac OS X 10_15_7`'yi,
 * Chromium `Windows NT 10.0`'ı donmuş bir değer olarak gönderiyor; yazılsa
 * yanlış olurdu. Backend bu değeri olduğu gibi cihaz adına koyuyor
 * (`DeviceNaming.fromHints`), o yüzden çıktı kullanıcıya gösterilecek
 * biçimde.
 *
 * Tanınmayan ajan `null` döner ve başlık hiç gönderilmez; backend o zaman
 * kendi ayrıştırıcısına düşer, "unknown" gibi bir yer tutucu göndermek onu
 * gerçek bir ad sanmasına yol açardı.
 */
export function operatingSystemFrom(userAgent: string | null): string | null {
  if (!userAgent) return null;

  // iPad'in masaüstü kipi kendini Macintosh olarak tanıtıyor; sıra önemli.
  const apple = /\b(?:iPhone|iPad|iPod)\b.*?\bOS (\d+)(?:_(\d+))?/.exec(userAgent);
  if (apple) return `iOS ${versionOf(apple[1], apple[2])}`;

  const android = /\bAndroid (\d+)(?:\.(\d+))?/.exec(userAgent);
  if (android) return `Android ${versionOf(android[1], android[2])}`;
  if (/\bAndroid\b/.test(userAgent)) return "Android";

  if (/\bCrOS\b/.test(userAgent)) return "ChromeOS";
  if (/\bWindows\b/.test(userAgent)) return "Windows";
  if (/\bMac OS X\b|\bMacintosh\b/.test(userAgent)) return "macOS";
  if (/\bLinux\b|\bX11\b/.test(userAgent)) return "Linux";

  return null;
}

/**
 * Chromium'un varsayılan olarak gönderdiği düşük entropili istemci ipucu
 * (`Sec-CH-UA-Platform: "macOS"`). Yalnız `User-Agent` tanınmadığında
 * okunur; değer tırnaklı ve `Unknown` olabilir.
 */
function platformHintFrom(value: string | null): string | null {
  const platform = value?.replaceAll('"', "").trim() ?? "";
  if (!platform || platform.toLowerCase() === "unknown") return null;
  return platform === "Chrome OS" || platform === "Chromium OS" ? "ChromeOS" : platform;
}

/**
 * Bu isteğin tarayıcısı için ipuçları.
 *
 * Model web'de her zaman boş: `User-Agent` donanımı söylemiyor ve
 * `navigator.userAgentData.getHighEntropyValues` tarayıcıda çalışıyor, oysa
 * giriş isteği BFF'den çıkıyor (ADR-0011). Sürüm build sabiti; işletim
 * sistemi bu isteğin `User-Agent`'ından, o da yoksa istemci ipucu
 * başlığından.
 */
export async function webDeviceHints(): Promise<DeviceHints> {
  const requestHeaders = await headers();
  return {
    model: null,
    os:
      operatingSystemFrom(requestHeaders.get("user-agent")) ??
      platformHintFrom(requestHeaders.get("sec-ch-ua-platform")),
    appVersion: webAppVersion,
  };
}

function versionOf(major: string, minor: string | undefined): string {
  return minor === undefined ? major : `${major}.${minor}`;
}
