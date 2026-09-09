import "server-only";

import { apiFetch } from "@/server/api/client";
import { isNotFound, isUnauthorized } from "@/server/api/errors";
import { backendPaths } from "@/server/contract";
import { bffUpstreamTimeoutMs } from "@/server/env";

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
  /** Yalnız bu bekleyiciyi iptal eder; paylaşılan yenileme diğer çağıranlar için sürer. */
  signal?: AbortSignal;
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
  if (pending) return waitForRefresh(pending, input.signal);

  const request = requestRefresh(input).finally(() => {
    inFlight.delete(input.refreshToken);
  });
  inFlight.set(input.refreshToken, request);
  return waitForRefresh(request, input.signal);
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
      // Bir istemcinin iptali paylaşılan isteği kesmez; bu bağımsız üst sınır
      // askıda kalan isteğin ve inFlight girdisinin sonlu kalmasını sağlar.
      signal: AbortSignal.timeout(bffUpstreamTimeoutMs()),
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

function waitForRefresh(
  request: Promise<TokenPair>,
  signal: AbortSignal | undefined,
): Promise<TokenPair> {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise<TokenPair>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    request.then(
      (pair) => {
        signal.removeEventListener("abort", onAbort);
        resolve(pair);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}
