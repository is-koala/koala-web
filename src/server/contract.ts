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
