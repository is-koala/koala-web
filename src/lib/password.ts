/**
 * Parolanın tek kuralı.
 *
 * Backend `ResetPasswordDto` sıfırlamada `@Size(min = 8)` ve
 * `@Pattern("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$")` uyguluyor, ama
 * `AuthCompleteRegistrationDto` parolayı yalnız `@NotNull` ile alıyor: kayıt
 * ucundan tek harflik bir parola geçer ve o kullanıcı daha sonra aynı
 * parolayı sıfırlama ekranından geri koyamaz. Kural bu yüzden istemcide
 * zorunlu ve kayıtla sıfırlamada birebir aynı; mobil `PasswordRule` de aynı
 * dört koşulu uyguluyor. Backend'in kayıt ucunu sıkılaştırması
 * is-koala/koala-backend#43 ile ayrı izleniyor.
 */
export const minPasswordLength = 8;

/** HTML `pattern` özniteliği kalıbı çapasız ister; JS tarafı çapayı ekler. */
export const passwordPattern = "(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+";

/** Kuralı karşılamayan parola için kullanıcıya gösterilen tek cümle. */
export const passwordRequirement =
  "Parola en az 8 karakter olmalı; en az bir büyük harf, bir küçük harf ve bir rakam içermeli.";

const strongPassword = new RegExp(`^${passwordPattern}$`);

export function isStrongPassword(candidate: string): boolean {
  return candidate.length >= minPasswordLength && strongPassword.test(candidate);
}

/** Parola tekrarı tutmadığında gösterilen tek cümle. */
export const passwordsDoNotMatch = "Parolalar eşleşmiyor.";

/** Parola çiftinin hangi kuralda takıldığı; kural yoksa `null`. */
export type PasswordProblem = "weak" | "mismatch" | null;

/**
 * Kayıt ve sıfırlama aynı sırayı uyguluyor: önce kural, sonra tekrar. Alan
 * adları iki uçta farklı olduğu için mesajı çağıran kendi alanına bağlar.
 */
export function passwordProblem(password: string, confirmation: string): PasswordProblem {
  if (!isStrongPassword(password)) return "weak";
  if (password !== confirmation) return "mismatch";
  return null;
}
