import { safeInternalPath } from "@/lib/urls";

/**
 * Kimlik doğrulama web'de çiple tamamlanamaz; belge yolu tamamlanır.
 *
 * Backend `POST /users/me/identity-verification` bayrak açıkken `sod` + `dg1`
 * ister. Tarayıcıda Web NFC / WebUSB o protokolü bitirmiyor. Beş alanlık form
 * damgalamaz. Ürün yolu `POST /users/me/identity-documents` (dört TCKK fotoğrafı) +
 * personel onayı. Çip BFF uçları hâlâ 501 döner; kapı `/kimlik-dogrula`'ya
 * düşer.
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
  const next = identityReturnPath(returnPath);
  if (!next) return identityVerificationPath;
  return `${identityVerificationPath}?next=${encodeURIComponent(next)}`;
}

/** Kimlik ekranının kendi varyantlarını ve güvensiz hedefleri dönüş yolundan çıkarır. */
export function identityReturnPath(returnPath?: string | null): string | null {
  const next = safeInternalPath(returnPath);
  return next && !isIdentityVerificationLocation(next) ? next : null;
}

function isIdentityVerificationLocation(path: string): boolean {
  // Sorgu ve fragment hedefi değiştirmez; bunları ayrı hedef saymak her
  // oturum bitişinde `/kimlik-dogrula`yı kendi içine yeniden sarardı.
  return new URL(path, "https://koala.invalid").pathname === identityVerificationPath;
}
