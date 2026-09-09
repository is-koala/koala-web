import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  apiFetch,
  apiFetchResponse,
  type ApiCaller,
  type HttpMethod,
} from "@/server/api/client";
import { isUnauthorized } from "@/server/api/errors";
import { ingressClientIpHeader, sessionCookies } from "@/server/contract";

import { clearSessionCookies, writeSessionCookies } from "./cookies";
import { createDeviceId, isValidDeviceId } from "./device-id";
import { currentPathLoginRedirect } from "./login-redirect";
import { refreshTokenPair, SessionExpiredError } from "./refresh";

export type Session = {
  deviceId: string;
  accessToken: string | null;
  refreshToken: string | null;
};

export type SessionRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  clientIp?: string | null;
  cache?: RequestCache;
  redirect?: RequestRedirect;
  signal?: AbortSignal;
};

export async function readSession(): Promise<Session> {
  const store = await cookies();
  return {
    deviceId: store.get(sessionCookies.deviceId)?.value ?? "",
    accessToken: store.get(sessionCookies.accessToken)?.value ?? null,
    refreshToken: store.get(sessionCookies.refreshToken)?.value ?? null,
  };
}

/**
 * Oturumu olmayan çağrının bağlamı.
 *
 * Giriş ve kayıt uçları token taşımaz ama backend web isteğinde cihaz
 * kimliğini zorunlu tutar (`ClientContext.requireWebDeviceId`). Çerez henüz
 * düşmemişse kimlik burada üretilir; çağıran onu oturum kurulduğunda çereze
 * yazarak vekildeki üretim yarışını kapatır.
 */
export async function anonymousCaller(): Promise<ApiCaller> {
  const session = await readSession();
  return {
    deviceId: isValidDeviceId(session.deviceId) ? session.deviceId : createDeviceId(),
    accessToken: null,
    clientIp: await ingressClientIp(),
  };
}

/**
 * Kimseye ait olmayan, istek bağlamı da taşımayan çağrı.
 *
 * `anonymousCaller`'dan ayrı duruyor ve fark tek kelimeyle **istek**:
 * o çerezi ve istemci IP'sini okuyor, yani `cookies()`/`headers()` çağırıyor
 * ve kullandığı her sayfayı dinamik render'a mahkûm ediyor. Statik üretilen
 * ya da ISR ile önbelleklenen bir tanıtım sayfası bunu karşılayamaz: Next
 * istek-zamanı API'si gördüğü anda önbelleklemeyi bırakır.
 *
 * Cihaz kimliği sabit ve bu bir kimlik değil, bir **yer tutucu**: backend web
 * çağrılarında yalnız oturum uçlarında zorunlu tutuyor
 * (`ClientContext.requireWebDeviceId`, yalnız `AuthManager` login/refresh),
 * herkese açık `GET` uçlarında hiç okumuyor. `apiFetch` yine de biçime uyan
 * bir değer istiyor — kural oturum çağrılarını koruyor ve gevşetilmemeli — o
 * yüzden buradan sabit, ayırt edici bir değer geçiyor. Ziyaretçiden türeyen
 * hiçbir şey taşımadığı için üretilen HTML de ziyaretçiden bağımsız.
 *
 * Yalnız kimlik istemeyen okumalarda kullanılır; token taşıyan bir akış için
 * `apiRequest` vardır.
 */
export function publicReaderCaller(): ApiCaller {
  return { deviceId: publicReaderDeviceId, accessToken: null, clientIp: null };
}

/** Biçim `deviceIdPattern`'e uyar; taşıdığı tek bilgi çağrının kamuya açık olduğu. */
const publicReaderDeviceId = "web-public-reader";

/**
 * Oturum bağlamını taşıyan backend çağrısı.
 *
 * Sayfalar ve action'lar tokenları hiç görmez: erişim tokenı ve cihaz
 * kimliği çerezlerden okunur, süresi dolmuşsa bir kez yenilenip istek
 * tekrarlanır.
 */
export async function apiRequest<T>(
  path: string,
  options: SessionRequestOptions = {},
): Promise<T> {
  const session = await readSession();
  const clientIp = options.clientIp ?? (await ingressClientIp());

  try {
    return await apiFetch<T>(path, {
      ...options,
      ...callerFrom(session, session.accessToken, clientIp),
    });
  } catch (error) {
    if (!isUnauthorized(error) || !session.refreshToken) throw error;

    const renewed = await renew(session, session.refreshToken, clientIp, options.signal);
    return apiFetch<T>(path, { ...options, ...callerFrom(session, renewed, clientIp) });
  }
}

/** Oturum yenilemeyi koruyarak zarf taşımayan dosya yanıtını döndürür. */
export async function apiRequestResponse(
  path: string,
  options: SessionRequestOptions = {},
): Promise<Response> {
  const session = await readSession();
  const clientIp = options.clientIp ?? (await ingressClientIp());

  try {
    return await apiFetchResponse(path, {
      ...options,
      ...callerFrom(session, session.accessToken, clientIp),
    });
  } catch (error) {
    if (!isUnauthorized(error) || !session.refreshToken) throw error;

    const renewed = await renew(session, session.refreshToken, clientIp, options.signal);
    return apiFetchResponse(path, {
      ...options,
      ...callerFrom(session, renewed, clientIp),
    });
  }
}

/**
 * ADR-0011: tarayıcının gönderdiği `Forwarded` / `X-Forwarded-For` güvenilmez
 * ve iletilmez. Ingress'in her istekte üzerine yazdığı başlık okunur; yoksa
 * backend'e hiç iletme başlığı gitmez ve bağlantı IP'sini kendisi görür.
 */
async function ingressClientIp() {
  const requestHeaders = await headers();
  return requestHeaders.get(ingressClientIpHeader);
}

/** `apiRequest` yenileme tokenının varlığını doğruladıktan sonra çağırır. */
async function renew(
  session: Session,
  refreshToken: string,
  clientIp: string | null | undefined,
  signal?: AbortSignal,
) {
  try {
    const pair = await refreshTokenPair({
      accessToken: session.accessToken,
      refreshToken,
      deviceId: session.deviceId,
      clientIp,
      signal,
    });
    await writeSessionCookies(pair);
    return pair.token;
  } catch (error) {
    if (!(error instanceof SessionExpiredError)) throw error;

    // Oturum bitti: çerezler temizlenir ve kullanıcı girişe alınır. Render
    // sırasında çerez silinemese bile giriş sayfası onları üzerine yazar.
    await clearSessionCookies();
    redirect(await currentPathLoginRedirect());
  }
}

function callerFrom(
  session: Session,
  accessToken: string | null,
  clientIp: string | null | undefined,
): ApiCaller {
  return { deviceId: session.deviceId, accessToken, clientIp };
}
