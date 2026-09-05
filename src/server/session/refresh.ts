import "server-only";

import { apiFetch } from "@/server/api/client";
import { isNotFound, isUnauthorized } from "@/server/api/errors";
import { backendPaths } from "@/server/contract";

/** `TokenResponseDto`. */
export type TokenPair = {
  token: string;
  refreshToken: string;
  refreshExpiresAt: string;
};

export type RefreshInput = {
  /** Süresi dolmuş olabilir; backend oturum kimliğini yine de ondan okur. */
  accessToken: string | null;
  refreshToken: string;
  deviceId: string;
  clientIp?: string | null;
};

/**
 * Oturumun bittiği anlaşıldı.
 *
 * Çağıranın yapacağı şey isteği tekrarlamak değil, kullanıcıyı girişe
 * göndermektir; bu yüzden ApiError'dan ayrı bir tip. Kullanıcıya
 * gösterilecek metin `errorCode` üzerinden `@/lib/errors` ile seçilir.
 */
export class SessionExpiredError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string) {
    super(`Oturum yenilenemedi: ${errorCode}`);
    this.name = "SessionExpiredError";
    this.errorCode = errorCode;
  }
}

const inFlight = new Map<string, Promise<TokenPair>>();

/**
 * Yenileme çağrısını yenileme tokenına göre paylaştırır.
 *
 * Aynı anda 401 alan birkaç istek tek yenileme üretir; aksi hâlde aynı
 * oturum için gereksiz eşzamanlı çağrılar gider ve backend'in cihaz
 * eşleşmesi kontrolü yarış hâlinde oturumu kapatabilir.
 */
export function refreshTokenPair(input: RefreshInput): Promise<TokenPair> {
  const pending = inFlight.get(input.refreshToken);
  if (pending) return pending;

  const request = requestRefresh(input).finally(() => {
    inFlight.delete(input.refreshToken);
  });
  inFlight.set(input.refreshToken, request);
  return request;
}

async function requestRefresh(input: RefreshInput): Promise<TokenPair> {
  try {
    return await apiFetch<TokenPair>(backendPaths.refreshToken, {
      method: "POST",
      // Backend oturum kimliğini süresi dolmuş erişim tokenından çıkarır;
      // eski token gönderilmezse yenileme yetkisiz sayılır.
      accessToken: input.accessToken,
      deviceId: input.deviceId,
      clientIp: input.clientIp,
      body: { refreshToken: input.refreshToken },
    });
  } catch (error) {
    // Oturumun bittiğini iki durum söyler: 401 reddedilmiş tokenı, 404 ise
    // sunucuda pasifleşmiş oturumu (`findActiveSessionById`) bildirir. 404'ü
    // geçici arıza sayıp yeniden denemek 401 → yenile → 404 döngüsü üretir.
    // Diğer hatalarda kullanıcıyı çıkışa zorlamak, yeniden denemekle
    // kurtulabilecek bir oturumu kaybettirirdi.
    if (isUnauthorized(error) || isNotFound(error)) {
      throw new SessionExpiredError(error.errorCode);
    }
    throw error;
  }
}
