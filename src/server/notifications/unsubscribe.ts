import "server-only";

import { readSingleToken } from "@/handoff/token";
import {
  unsubscribedOutcome,
  unsubscribeFailure,
  type UnsubscribeOutcome,
} from "@/notifications/unsubscribe";
import { apiFetch } from "@/server/api/client";
import { backendPaths } from "@/server/contract";
import { failureView } from "@/server/form";
import { anonymousCaller } from "@/server/session/session";

/**
 * Gövdede yalnız `{ token }` var ve token en çok 2048 karakter
 * (`UnsubscribeDto`); bundan büyüğü okunmadan geçersiz sayılır.
 */
const maxBodyBytes = 4_096;

/**
 * `POST /api/notification-preferences/unsubscribe`.
 *
 * Token hiçbir yere yazılmıyor: ne log, ne Sentry bağlamı, ne yanıt gövdesi.
 * Yanıt yalnız sonucu taşır; backend'in ham mesajı tarayıcıya çıkmaz, metni
 * istemci sonuç türünden ya da herkese açık katalogdan seçer. Aynı origin
 * denetimini `src/proxy.ts` her durum değiştiren istekte zaten yapıyor.
 */
export async function unsubscribeRoute(request: Request): Promise<Response> {
  const token = await tokenOf(request);
  const outcome: UnsubscribeOutcome =
    token === null ? { outcome: "invalid" } : await unsubscribe(token);
  return Response.json(outcome, {
    status: statusOf(outcome),
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Bağlantının taşıdığı tek kategori/kanalı kapatır.
 *
 * Uç giriş istemiyor (`SecurityConfig` permitAll): tarayıcıda açık bir oturum
 * olsa bile tokenın sahibi bağlantının kendisi, bu yüzden anonim çağıran
 * kullanılıyor. İstemci IP'si gidiyor ki backend'in hız sınırı ziyaretçiyi
 * BFF'nin adresiyle karıştırmasın.
 */
async function unsubscribe(token: string): Promise<UnsubscribeOutcome> {
  try {
    // `UnsubscribedChannelDto`; alanları `unsubscribedOutcome` tek tek okuyor.
    const data = await apiFetch<unknown>(backendPaths.notificationUnsubscribe, {
      ...(await anonymousCaller()),
      method: "POST",
      body: { token },
    });
    return unsubscribedOutcome(data);
  } catch (error) {
    // Hata nesnesi (ağ hatası dahil) loglanmıyor: istek ayrıntısı tokenı
    // taşıyabilir. Kod ve durum `failureView` ile ayıklanıyor.
    const { errorCode, httpStatus } = failureView(error);
    return unsubscribeFailure(errorCode, httpStatus);
  }
}

async function tokenOf(request: Request): Promise<string | null> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBodyBytes) {
    return null;
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > maxBodyBytes) return null;
    body = JSON.parse(text);
  } catch {
    return null;
  }

  const candidate =
    typeof body === "object" && body !== null ? (body as { token?: unknown }).token : undefined;
  if (typeof candidate !== "string") return null;
  const token = readSingleToken(candidate);
  return token.ok ? token.value : null;
}

function statusOf(outcome: UnsubscribeOutcome): number {
  switch (outcome.outcome) {
    case "unsubscribed":
      return 200;
    case "expired":
    case "invalid":
      return 400;
    case "failed":
      return outcome.httpStatus >= 400 && outcome.httpStatus <= 599 ? outcome.httpStatus : 500;
  }
}
