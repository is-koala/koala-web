import { readSingleToken } from "@/handoff/token";

/**
 * Ticari e-postadaki tek tıklık çıkışın sözleşmesi (is-koala/koala-web#54,
 * koala-backend#234).
 *
 * Akış bilerek üç adımlı: sayfa statik ve tokenı sunucuda hiç okumuyor;
 * tarayıcı tokenı adres çubuğundan kullanıcı onayladığında okuyup aynı
 * origin'deki BFF ucuna POST ediyor; BFF backend'e gidiyor. Sayfayı açmak
 * hiçbir şeyi değiştirmez — e-posta tarayıcıları ve bağlantı önizleyicileri
 * bağlantıyı GET ile açıyor ve backend ucu bu yüzden POST.
 *
 * Bu modül hem BFF'de hem istemcide okunuyor: sonuç birliği, backend
 * kodlarının sonuca eşlenmesi ve BFF yanıtının okunması tek yerde dursun.
 */

/** BFF ucu; tarayıcı `api.iskoala.com` ile konuşmaz (ADR-0011). */
export const unsubscribeEndpoint = "/api/notification-preferences/unsubscribe";

/**
 * `NotificationPreferenceMessages`; kod `KoalaException.deriveErrorCode` ile
 * mesaj anahtarından türüyor. Tanınmayan ve bozulmuş token backend'de
 * bilerek ayırt edilmiyor, süresi dolan gerçek token ayrı kodla dönüyor.
 */
const tokenExpired = "NOTIFICATION_UNSUBSCRIBE_TOKEN_EXPIRED";
const tokenInvalid = "NOTIFICATION_UNSUBSCRIBE_TOKEN_INVALID";
/** Boş ya da 2048'den uzun token bean validation'a takılıyor (`details[].field=token`). */
const validationFailed = "VALIDATION_FAILED";
const unexpectedError = "UNEXPECTED";

export type UnsubscribeOutcome =
  | {
      outcome: "unsubscribed";
      /** `UnsubscribedChannelDto.category`; okunamazsa `null`, başarı yine başarıdır. */
      category: string | null;
      channel: string | null;
      /**
       * Token tek kullanımlık değil, süreli: ikinci tık aynı kanalı
       * `alreadyDisabled=true` ile döndürür ve hiçbir satır yeniden yazılmaz.
       * Kullanıcıya hata olarak gösterilmez.
       */
      alreadyDisabled: boolean;
    }
  | { outcome: "expired" }
  | { outcome: "invalid" }
  | { outcome: "failed"; errorCode: string; httpStatus: number };

/**
 * Backend reddinin sonucu. Dallanma `errorCode` ile, mesaj metniyle asla
 * (`AGENTS.md`); bağlantıya özgü olmayan her ret genel hataya düşer ve metni
 * herkese açık katalogdan seçilir.
 */
export function unsubscribeFailure(errorCode: string, httpStatus: number): UnsubscribeOutcome {
  if (errorCode === tokenExpired) return { outcome: "expired" };
  if (errorCode === tokenInvalid || errorCode === validationFailed) return { outcome: "invalid" };
  return { outcome: "failed", errorCode, httpStatus };
}

/**
 * Başarının okunmuş hâli; backend `UnsubscribedChannelDto`'sunu da BFF
 * gövdesini de aynı yoldan okur. Alanlar ayrı ayrı denetleniyor: sözleşme
 * kayarsa başarı yine başarıdır, yalnız ayrıntı eksik çizilir.
 */
export function unsubscribedOutcome(data: unknown): UnsubscribeOutcome {
  const candidate = isRecord(data) ? data : {};
  return {
    outcome: "unsubscribed",
    category: textOrNull(candidate.category),
    channel: textOrNull(candidate.channel),
    alreadyDisabled: candidate.alreadyDisabled === true,
  };
}

/**
 * Adres çubuğundaki token. Tekrarlanan parametrede hangisinin kastedildiği
 * belli olmadığı için token sayılmaz; boş ve aşırı uzun değer backend'e hiç
 * sorulmaz (`readSingleToken`, öbür karşılama sayfalarıyla aynı kural).
 */
export function unsubscribeTokenFrom(search: string): string | null {
  const values = new URLSearchParams(search).getAll("token");
  if (values.length !== 1) return null;
  const token = readSingleToken(values[0]);
  return token.ok ? token.value : null;
}

/**
 * BFF yanıtının okunmuş hâli. Ters vekil HTML ya da boş gövde döndürebilir;
 * tanınmayan gövde asla başarı sayılmaz.
 */
export function unsubscribeOutcomeFrom(status: number, body: unknown): UnsubscribeOutcome {
  const candidate = isRecord(body) ? body : {};
  switch (candidate.outcome) {
    case "unsubscribed":
      if (status >= 200 && status < 300) return unsubscribedOutcome(candidate);
      break;
    case "expired":
      return { outcome: "expired" };
    case "invalid":
      return { outcome: "invalid" };
    case "failed":
      if (typeof candidate.errorCode === "string" && typeof candidate.httpStatus === "number") {
        return { outcome: "failed", errorCode: candidate.errorCode, httpStatus: candidate.httpStatus };
      }
      break;
  }
  return { outcome: "failed", errorCode: unexpectedError, httpStatus: status >= 400 ? status : 500 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
