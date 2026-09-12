import { redirect } from "next/navigation";

/**
 * `apiRequest`'in oturum render ortasında bitince fırlattığı kesmenin
 * birebir kendisi.
 *
 * Testler bunu backend taklidinin reddi olarak verir ve yükleyicinin onu
 * **değiştirmeden** dışarı çıkardığını `rejects.toBe` ile ölçer. Sahte bir
 * dize değil gerçek `redirect()` üretiyor: `unstable_rethrow`'un tanıdığı
 * biçim Next sürümüyle değişebilir ve test o biçime bağlı kalmamalı.
 *
 * `tests/support/navigation.ts`'ten ayrı bir dosya, bilerek: o modül
 * `next/navigation` **taklidinin** parçası olarak yükleniyor ve gerçek
 * modülü içeri alamaz. Burası yalnız `next/navigation`'ı taklit etmeyen ya
 * da `importOriginal` ile gerçeğini koruyan testlerden çağrılır.
 */
export function sessionExpiryRedirect(target = "/giris?next=%2Fpanel"): unknown {
  try {
    redirect(target);
  } catch (interrupt) {
    return interrupt;
  }
  throw new Error("redirect() kesme fırlatmadı");
}
