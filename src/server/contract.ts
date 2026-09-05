import "server-only";

/**
 * Backend sözleşmesinin kayabilecek parçaları.
 *
 * Bu değerler koala-backend'in Java kaynağından okundu ve hâlâ gelişen bir
 * dalgadan geliyor. Sözleşme değişirse tek dosyada tek satır güncellensin
 * diye kod içine dağıtılmadan burada toplanır.
 */

/** `DeviceIdentity.HEADER`, `ClientPlatform.HEADER`, `MinimumAppVersionFilter`. */
export const backendHeaders = {
  acceptLanguage: "Accept-Language",
  appVersion: "X-App-Version",
  authorization: "Authorization",
  clientPlatform: "X-Client-Platform",
  deviceId: "X-Device-Id",
  forwardedFor: "X-Forwarded-For",
  minimumAppVersion: "X-Minimum-App-Version",
} as const;

/** `ClientPlatform.WEB`; backend değeri büyük/küçük harf duyarsız okur. */
export const webClientPlatform = "web";

/** Backend başlıksız istekte de Türkçe varsayar; yine de açıkça gönderilir. */
export const backendLanguage = "tr";

/**
 * Sürüm kapısı. `MinimumAppVersionFilter` eski istemciye 426 ve
 * `X-Minimum-App-Version` döner; gövdedeki kod ve kategori sabittir.
 */
export const upgradeRequiredStatus = 426;
export const upgradeRequiredErrorCode = "UPGRADE_REQUIRED";

/**
 * `ErrorCategory.UNEXPECTED`. `ErrorResult` kod verilmediğinde kategori adını
 * koda kopyalar, bu yüzden aynı değer hem kategori hem kod olarak geçerlidir;
 * zarf hiç okunamadığında da bu nötr değere düşülür.
 */
export const unexpectedError = "UNEXPECTED";

/**
 * `AppVersion.numericPrefix`: sürüm, `+` ya da `-` öncesinde noktayla
 * ayrılmış en fazla dokuz basamaklı sayılardan oluşmalı. Okunamayan sürüm,
 * tanımlı bir platform eşiği varsa 426 ile reddedilir.
 */
export const parsableAppVersion = /^\d{1,9}(\.\d{1,9})*([+-].*)?$/;

/**
 * `DeviceIdentity.SAFE_ID`. Kalıba uymayan kimliği backend yok sayar; web
 * login ve refresh çağrılarında kimlik zorunlu olduğu için bu istekleri
 * reddeder.
 */
export const deviceIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Oturum çerezleri. Tokenlar ve cihaz kimliği yalnız sunucuda okunur;
 * tarayıcı JavaScript'i bunlara erişemez.
 */
export const sessionCookies = {
  accessToken: "koala_at",
  refreshToken: "koala_rt",
  deviceId: "koala_did",
} as const;

/** `AuthController` ucu; backend'de context-path yok, yol kök altında. */
export const backendPaths = {
  refreshToken: "/auth/refresh-token",
} as const;

/** Erişim tokenı reddedildiğinde backend bu durumu döner. */
export const unauthorizedStatus = 401;

/**
 * ADR-0011 gereği oturum çerezleri tarayıcı JavaScript'ine kapalıdır.
 * `SameSite=Lax` CSRF'e karşı ilk savunma; durum değiştiren istekler ayrıca
 * `src/proxy.ts` içinde origin doğrulamasından geçer.
 */
export const secureCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
} as const;

/**
 * Cihaz kimliği tarayıcı profilini temsil eder, oturumu değil: kullanıcı
 * çıkış yapsa da aynı kalır. Silinirse aynı tarayıcı yeni cihaz sayılır,
 * bu yüzden ömrü uzun tutulur.
 */
export const deviceIdMaxAgeSeconds = 63_072_000;

/**
 * Ingress'in yazdığı gerçek istemci IP'si. Tarayıcının gönderdiği
 * `Forwarded` / `X-Forwarded-For` güvenilmez ve iletilmez; ingress bu
 * başlığı her istekte kendisi üzerine yazar.
 */
export const ingressClientIpHeader = "x-real-ip";
