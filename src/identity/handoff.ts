import { safeInternalPath } from "@/lib/urls";

/**
 * Kimlik doğrulama web'de tamamlanamaz.
 *
 * Backend `POST /users/me/identity-verification` bayrak açıkken `sod` + `dg1`
 * ister; Active Authentication açıksa bir de `dg15` + `challenge` +
 * `activeAuthenticationSignature` zorunlu. Bu kanıt ISO 14443 çipten
 * `INTERNAL AUTHENTICATE` ile çıkar. Tarayıcıda Web NFC / WebUSB o protokolü
 * bitirmiyor; beş alanı elle doldurmak ise yalnız
 * `IDENTITY_PASSIVE_AUTH_ENABLED=false` iken geçen geçici bir delik — doğrulama
 * değil. Bu yüzden web, doğrulanmamış kullanıcıyı uygulamaya bırakır.
 */
export const identityVerificationPath = "/kimlik-dogrula";

/** Çip PA tarayıcıda üretilemediğinde BFF'in döndürdüğü kod. */
export const identityChipPaUnavailableErrorCode = "IDENTITY_CHIP_PA_NOT_AVAILABLE_ON_WEB";

/**
 * Kimlik kapısının kanonik ekranı; dönüş yolu güvenliyse `next` olarak gider.
 *
 * Kapı şeridi, başvuru reddi ve BFF 501'i aynı adrese bağlar. Dışarıya çıkan
 * bir `next` giriş sayfasındaki gibi düşer: açık yönlendirme aracı olmasın.
 */
export function identityHandoffHref(returnPath?: string | null): string {
  const next = safeInternalPath(returnPath);
  if (!next || next === identityVerificationPath) return identityVerificationPath;
  return `${identityVerificationPath}?next=${encodeURIComponent(next)}`;
}
