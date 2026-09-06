export type SearchValue = string | string[] | undefined;

export function readSingleToken(
  value: SearchValue,
): { ok: true; value: string } | { ok: false } {
  if (typeof value !== "string") return { ok: false };
  const token = value.trim();
  if (!token || token.length > 2048) return { ok: false };
  return { ok: true, value: token };
}

/**
 * `AuthVerifyRegistrationTokenDto.registrationToken` bir `UUID`.
 *
 * Biçimi tutmayan bir değer backend'de gövde çözümlemesinde 400'e dönüşür ve
 * kullanıcıya anlamsız bir doğrulama hatası olarak görünür; üstelik `AUTH`
 * hız kovasından boşuna bir hak yakar. Bu yüzden sayfa, biçimi burada eleyip
 * backend'e hiç sormaz.
 */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readUuidToken(
  value: SearchValue,
): { ok: true; value: string } | { ok: false } {
  const token = readSingleToken(value);
  if (!token.ok || !uuid.test(token.value)) return { ok: false };
  return token;
}
