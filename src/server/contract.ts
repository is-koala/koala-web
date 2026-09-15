import "server-only";

/**
 * Backend sözleşmesinin kayabilecek parçaları.
 *
 * Bu değerler koala-backend'in Java kaynağından okundu ve hâlâ gelişen bir
 * dalgadan geliyor. Sözleşme değişirse tek dosyada tek satır güncellensin
 * diye kod içine dağıtılmadan burada toplanır.
 */

/**
 * `DeviceIdentity.HEADER`, `ClientPlatform.HEADER`, `MinimumAppVersionFilter`,
 * `DeviceHints` (`X-Koala-*`).
 *
 * Üç cihaz ipucu yalnız oturum açan uçlarda okunuyor (`DeviceIdentityRequest`,
 * giriş ve yenileme): backend cihaz adını bunlardan kuruyor
 * (`DeviceNaming.name`), ipucu yoksa BFF'nin Node `User-Agent`'ından — yani
 * web oturumu "Bilinmeyen cihaz" kalıyordu (is-koala/koala-web#188).
 * `X-App-Version` ayrı bir şey: sürüm kapısının okuduğu çalışma zamanı
 * değeri, cihaz adına giren değil.
 */
export const backendHeaders = {
  acceptLanguage: "Accept-Language",
  appVersion: "X-App-Version",
  authorization: "Authorization",
  clientPlatform: "X-Client-Platform",
  deviceAppVersion: "X-Koala-App-Version",
  deviceId: "X-Device-Id",
  deviceModel: "X-Koala-Device-Model",
  deviceOs: "X-Koala-OS",
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

/**
 * `AuthController`, `LegalController`, `UsersController`, `JobsController`,
 * `JobAssignmentsController`, `PaymentsController`, `EmployerToolsController`,
 * `AddressSearchController`, `ReferenceDataController` ve `ContactController`
 * uçları; backend'de context-path yok.
 *
 * Adres uçlarının kimlik alan parçaları burada değil `@/server/address/gateway`
 * içinde birleştirilir: kimlikler tarayıcıdan geldiği için yola konmadan önce
 * UUID olduklarının doğrulanması gerekiyor.
 */
export const backendPaths = {
  accountDeletion: "/legal/account-deletion",
  addressCandidateReverse: "/locations/address-candidates/reverse",
  addressSearchSessions: "/locations/address-search-sessions",
  agreements: "/legal/agreements",
  completeRegistration: "/auth/complete-registration",
  currentUserPayouts: "/users/me/payouts",
  /**
   * `PATCH /users/me/devices/{deviceId}` — cihazı adlandırma
   * (`UserProfileController`, backend 0.9.28). Adı `usersMe` ile başlamıyor:
   * `server-only.test.ts` kabuğun tek `GET /users/me` çağrısını o önekle
   * arıyor ve bu bambaşka bir uç.
   */
  devices: "/users/me/devices",
  forgotPassword: "/auth/forgot-password",
  /**
   * `POST /users/me/jobs` — bireysel ilan; yanıt `IndividualJobDto`.
   *
   * Adı `usersMe...` ile başlamıyor, bilerek: `server-only.test.ts` kabuğun
   * tek `GET /users/me` çağrısını o önekle arıyor ve bu bambaşka bir uç.
   * Aynı yol `GET` ile creator bazlı ilan listesini de veriyor (#33).
   */
  individualJobs: "/users/me/jobs",
  jobAssignments: "/job-assignments",
  /** `GET /reference/job-categories`; `requiresInsurance` bayrağını taşıyor. */
  jobCategories: "/reference/job-categories",
  /**
   * `GET /jobs/{jobId}` — `JobDetailDto`. Yayımlanmış ilanın donmuş fiyat
   * snapshot'ı `pricing` alanında bu uçtan okunuyor.
   */
  jobs: "/jobs",
  /** `GET /sitemap/jobs/manifest` — değişmez ilan sitemap snapshot kaydı. */
  jobSitemapManifest: "/sitemap/jobs/manifest",
  /** `GET /users/me/job-templates` — `EmployerToolsController.java:101-102`. */
  jobTemplates: "/users/me/job-templates",
  login: "/auth/login",
  logout: "/auth/logout",
  bankAccounts: "/users/me/bank-accounts",
  changePassword: "/users/me/password",
  notifications: "/users/me/notifications",
  /**
   * `POST /payment-quotes`. İlan öncesi fiyat dökümü; aynı hesap ilan
   * yayımlanırken `pricingService.snapshot(job)` ile tekrar yapılıp kilitlenir.
   */
  paymentQuotes: "/payment-quotes",
  /**
   * `POST /public/contact` — tanıtım sitesi destek formu. SMTP backend'de.
   */
  publicContact: "/public/contact",
  refreshToken: "/auth/refresh-token",
  referenceCities: "/reference/cities",
  referenceCountries: "/reference/countries",
  realtimeCredential: "/users/me/realtime-credential",
  resetPassword: "/auth/reset-password",
  sessions: "/users/me/sessions",
  startRegistration: "/auth/start-registration",
  /**
   * `GET/PUT/DELETE /users/me/talent-pool[/{workerId}]` —
   * `EmployerToolsController.java:58-95`. Ekleme `PUT` ile idempotent bir
   * upsert; `POST` yok.
   *
   * Adı `usersMe...` ile başlamıyor, bilerek: `server-only.test.ts` kabuğun
   * tek `GET /users/me` çağrısını o önekle arıyor.
   */
  talentPool: "/users/me/talent-pool",
  /**
   * `PUT /users/me/address`. Adı `usersMe` ile başlamıyor: `server-only.test.ts`
   * kabuğun tek `GET /users/me` çağrısını o önekle arıyor ve bu bambaşka bir uç.
   */
  currentUserAddress: "/users/me/address",
  /**
   * `GET/POST /users/me/identity-documents` — TCKK incelemesi. Adı `usersMe`
   * ile başlamıyor: `server-only.test.ts` kabuğun tek `GET /users/me`
   * çağrısını o önekle arıyor ve bu bambaşka bir uç.
   */
  identityDocuments: "/users/me/identity-documents",
  /**
   * Oturum sahibinin profili. Kabuğun ihtiyaç duyduğu her alanı tek yanıtta
   * taşıyor — `isEmployer`, `identityVerified`, `maskedTcIdentityNumber`,
   * `address` ve `companies[].approved` — bu yüzden şirket onayı için ikinci
   * bir tur gerekmiyor.
   */
  usersMe: "/users/me",
  workerAssignments: "/users/me/assignments?asEmployer=false",
  employerAssignments: "/users/me/assignments?asEmployer=true",
  verifyRegistrationToken: "/auth/verify-registration-token",
} as const;

/**
 * Tek bir ilanın adresi. Kimlik tarayıcıdan geliyor; yola konmadan kaçırılır.
 *
 * Burada, `backendPaths`'in yanında duruyor çünkü ilan kaynağının adresini
 * kuran **tek** yer olması gerekiyor. İki çevirici de aynı üç satırı yorumuyla
 * birlikte taşıyordu (`jobs.ts`, `public-jobs.ts`) ve kaçırmayı unutan bir
 * kopya, ilan kimliğini doğrudan yola yazan bir yol açardı. Aynı gerekçeyle
 * `companyPath` şirket modülünde tek yerde duruyor.
 */
export function jobPath(jobId: string): string {
  return `${backendPaths.jobs}/${encodeURIComponent(jobId)}`;
}

/**
 * `GET /users/{userId}/employer-stats` — herkese açık işveren istatistiği.
 *
 * Kimlik ilan yanıtındaki `creator.id`'den geliyor, tarayıcıdan değil; yine
 * de yola konmadan kaçırılıyor, `jobPath` ile aynı gerekçeyle.
 */
export function employerStatsPath(userId: string): string {
  return `/users/${encodeURIComponent(userId)}/employer-stats`;
}

/**
 * Manifest version'ına bağlı değişmez sitemap shard'ı.
 *
 * Çağıran bu değerleri route sınırında UUID ve signed 32-bit integer olarak
 * doğrular; kaçırma burada yine defense-in-depth olarak kalır.
 */
export function jobSitemapShardPath(version: string, shard: number): string {
  return `/sitemap/jobs/manifests/${encodeURIComponent(version)}/shards/${encodeURIComponent(String(shard))}`;
}

/** Erişim tokenı reddedildiğinde backend bu durumu döner. */
export const unauthorizedStatus = 401;

/**
 * `ResourceNotFoundException`. Yenileme yolunda ayrı bir anlamı var:
 * `SessionManager.findActiveSessionById` pasifleşmiş oturumu bulamayınca bu
 * durumu döner, yani 404 da oturumun bittiğini söyler.
 */
export const notFoundStatus = 404;

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
 * Cihaz kimliği çerezinin tam ayarı. Kimlik hem vekilde (ilk üretim) hem
 * giriş akışında (oturumun bağlandığı kimlikle tazeleme) yazıldığı için
 * ayarın iki yerde ayrışmaması gerekiyor.
 */
export const deviceIdCookieOptions = {
  ...secureCookieOptions,
  maxAge: deviceIdMaxAgeSeconds,
} as const;

/**
 * Ingress'in yazdığı gerçek istemci IP'si. Tarayıcının gönderdiği
 * `Forwarded` / `X-Forwarded-For` güvenilmez ve iletilmez; ingress bu
 * başlığı her istekte kendisi üzerine yazar.
 */
export const ingressClientIpHeader = "x-real-ip";

/**
 * Vekilin isteğe yazdığı, render edilen sayfanın yolu. Server component'ler
 * kendi adreslerini okuyamaz; oturum render ortasında bittiğinde kullanıcıyı
 * bıraktığı sayfaya döndürebilmek için tek kaynak budur. Değeri yalnız
 * `src/proxy.ts` koyar ve tarayıcıdan gelen aynı adlı başlığın üzerine yazar.
 */
export const requestPathHeader = "x-koala-path";
