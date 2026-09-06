/**
 * Backend'in ondalık dizelerini ekrana çevirir.
 *
 * `PricingBreakdownDto` bütün tutarları **dize** olarak gönderiyor ve DTO'nun
 * kendi yorumu nedenini yazıyor: istemcinin backend yuvarlamasını kayan
 * noktayla yeniden üretmesi istenmiyor. Bu yüzden burada tek bir aritmetik
 * işlem yok — `Number(...)` bile yok. Dize ayrıştırılıyor, gruplanıyor ve
 * yeniden yazılıyor; girdi beklenen biçimde değilse olduğu gibi geri veriliyor.
 *
 * `Intl.NumberFormat` kullanılmıyor çünkü o bir `number` istiyor: 2^53'ü aşan
 * ya da fazla ondalık taşıyan bir tutar oraya girerken bozulurdu.
 */

/** Ölçek 2 (koala-backend `CLAUDE.md` §2e); daha uzun ondalık para değildir. */
const moneyPattern = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/** `PricingManager.CURRENCY` bugün yalnız `TRY` üretiyor; gerisi koduyla yazılır. */
const currencySymbols: Readonly<Record<string, string>> = { TRY: "₺" };

export function formatMoney(amount: string, currency: string): string {
  const match = moneyPattern.exec(amount.trim());
  if (!match) return amount;

  const [, sign, whole, fraction = ""] = match;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const kurus = `${fraction}00`.slice(0, 2);

  return `${sign}${grouped},${kurus} ${currencySymbols[currency] ?? currency}`;
}
