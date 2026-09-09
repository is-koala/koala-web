import { vi } from "vitest";

/**
 * `next/navigation` sınırının test taklidi.
 *
 * Gerçek `redirect` akışı bir istisnayla keser; testler de hedefi o
 * istisnanın metninden okur. Bu dizge iki test dosyasının paylaştığı yalın
 * bir sözleşme olduğu için tek yerde durur: öneki kopyalamak, birinin
 * beklentisi değişince diğerinin sessizce yanlış geçmesi demekti.
 */
const redirectPrefix = "REDIRECT:";

/** Yönlendirmeyi bekleyen testin arayacağı hata metni. */
export function redirectTo(target: string): string {
  return `${redirectPrefix}${target}`;
}

/** Çağrı sayısı da doğrulanabilsin diye casus; çağrıldığında akışı keser. */
export function throwingRedirect() {
  return vi.fn((target: string) => {
    throw new Error(redirectTo(target));
  });
}

/**
 * Test redirect'ini Next'in iç hata tipine bağlanmadan yeniden fırlatır.
 *
 * `unstable_rethrow` mock'ları bunu kullanır: yalnız `throwingRedirect`
 * tarafından üretilen kontrol akışı geçer, sıradan uygulama hataları catch
 * sınırının mevcut failure-state eşlemesine bırakılır.
 */
export function rethrowTestNavigationError(error: unknown): void {
  if (error instanceof Error && error.message.startsWith(redirectPrefix)) throw error;
}
