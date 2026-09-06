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

/**
 * Toplamı yine ondalık dize olarak tutar; böylece bir liste özeti de tek tek
 * satırlar gibi backend kuruşlarını JavaScript sayı sınırında kaybetmez.
 */
export function sumMoney(amounts: readonly string[]): string | null {
  let total = "0";
  for (const amount of amounts) {
    const minorUnits = toMinorUnits(amount);
    if (minorUnits === null) return null;
    total = addUnsignedIntegers(total, minorUnits);
  }
  const padded = total.padStart(3, "0");
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

function toMinorUnits(amount: string): string | null {
  const match = moneyPattern.exec(amount.trim());
  if (!match || match[1] === "-") return null;
  return `${match[2]}${`${match[3] ?? ""}00`.slice(0, 2)}`.replace(/^0+(?=\d)/, "");
}

function addUnsignedIntegers(left: string, right: string): string {
  let carry = 0;
  let result = "";
  for (let offset = 1; offset <= Math.max(left.length, right.length); offset += 1) {
    const sum = Number(left.at(-offset) ?? 0) + Number(right.at(-offset) ?? 0) + carry;
    result = `${sum % 10}${result}`;
    carry = Math.floor(sum / 10);
  }
  return `${carry || ""}${result}`.replace(/^0+(?=\d)/, "");
}
