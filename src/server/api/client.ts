import "server-only";

import {
  backendHeaders,
  backendLanguage,
  deviceIdPattern,
  unexpectedError,
  upgradeRequiredErrorCode,
  upgradeRequiredStatus,
  webClientPlatform,
} from "@/server/contract";
import { serverEnvironment } from "@/server/env";

import { ApiError, type ApiFieldError } from "./errors";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Çağrının kime ait olduğu. Üç alan da aynı istek bağlamından gelir ve
 * birlikte yolculuk eder; oturum katmanı bunu tek parça olarak üretir.
 */
export type ApiCaller = {
  /** Tarayıcı profiline ait sabit cihaz kimliği; backend web çağrılarında zorunlu. */
  deviceId: string;
  accessToken?: string | null;
  /**
   * Bağlantının gerçek istemci IP'si. ADR-0011 gereği tarayıcıdan gelen
   * `Forwarded` / `X-Forwarded-For` iletilmez; backend'e yalnız bu değerden
   * üretilen tek bir başlık gider.
   */
  clientIp?: string | null;
};

export type ApiRequestOptions = ApiCaller & {
  method?: HttpMethod;
  body?: unknown;
  cache?: RequestCache;
  redirect?: RequestRedirect;
  signal?: AbortSignal;
};

type BackendEnvelope = {
  success?: boolean;
  message?: string;
  data?: unknown;
  errorCode?: string;
  errorCategory?: string;
  requestId?: string;
  details?: ApiFieldError[];
};

/**
 * Backend'e giden tek kapı.
 *
 * Tarayıcı `api.iskoala.com` ile hiç konuşmadığı için başlık enjeksiyonu,
 * zarf açma ve hata tiplemesi burada bir kez yapılır; çağıranlar ham zarfı
 * hiç görmez.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const response = await apiFetchResponse(path, options);
  const body = await readBody(response);
  const envelope = body.envelope ?? {};
  const unreadable = body.present && body.envelope === null;

  if (unreadable || envelope.success === false) {
    throw apiError(response, envelope);
  }

  return (envelope.data ?? null) as T;
}

/** Zarf taşımayan dosya yanıtları için aynı güvenli backend kapısının ham biçimi. */
export async function apiFetchResponse(
  path: string,
  options: ApiRequestOptions,
): Promise<Response> {
  // Backend kalıba uymayan kimliği sessizce yok sayar; hata web login ve
  // refresh çağrılarında ilgisiz bir doğrulama mesajı olarak geri döner.
  // Kimliği src/proxy.ts ürettiği için buraya düşmesi yapılandırma hatasıdır.
  if (!deviceIdPattern.test(options.deviceId)) {
    throw new Error("Cihaz kimliği backend biçimine uymuyor.");
  }

  const { apiUrl, appVersion } = serverEnvironment();

  const headers = new Headers({
    [backendHeaders.acceptLanguage]: backendLanguage,
    [backendHeaders.appVersion]: appVersion,
    [backendHeaders.clientPlatform]: webClientPlatform,
    [backendHeaders.deviceId]: options.deviceId,
  });

  if (options.clientIp) {
    headers.set(backendHeaders.forwardedFor, options.clientIp);
  }

  if (options.accessToken) {
    headers.set(backendHeaders.authorization, `Bearer ${options.accessToken}`);
  }

  const hasBody = options.body !== undefined;
  const multipartBody = hasBody && options.body instanceof FormData;
  if (hasBody && !multipartBody) {
    headers.set("Content-Type", "application/json");
  }
  const requestBody: BodyInit | undefined = multipartBody
    ? (options.body as FormData)
    : hasBody
      ? JSON.stringify(options.body)
      : undefined;

  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: requestBody,
    cache: options.cache,
    redirect: options.redirect,
    signal: options.signal,
  });

  if (options.redirect === "manual" && response.status >= 300 && response.status < 400) {
    return response;
  }
  if (!response.ok) {
    const body = await readBody(response);
    throw apiError(response, body.envelope ?? {});
  }
  return response;
}

function apiError(response: Response, envelope: BackendEnvelope): ApiError {
  return new ApiError({
    status: response.status,
    errorCode: envelope.errorCode ?? fallbackErrorCode(response.status),
    errorCategory: envelope.errorCategory ?? unexpectedError,
    message: envelope.message ?? "",
    details: envelope.details,
    requestId: envelope.requestId,
    minimumAppVersion: response.headers.get(backendHeaders.minimumAppVersion),
    retryAfter: response.headers.get("Retry-After"),
  });
}

/**
 * Ağ geçidi zarf yerine HTML ya da boş gövde döndürebilir. Gövdenin hiç
 * olmaması (204) ile okunamaması ayrı durumlardır: ikincisi 200 ile gelse
 * bile sessizce boş veri sayılmaz.
 */
async function readBody(
  response: Response,
): Promise<{ present: boolean; envelope: BackendEnvelope | null }> {
  const text = await response.text();
  if (!text.trim()) return { present: false, envelope: null };
  try {
    return { present: true, envelope: JSON.parse(text) as BackendEnvelope };
  } catch {
    return { present: true, envelope: null };
  }
}

/**
 * Sürüm kapısı gövdesi okunamasa bile kullanıcı "sayfayı yenile" yönergesini
 * görmeli; kodsuz kalan diğer hatalar backend'in nötr kategorisine düşer.
 */
function fallbackErrorCode(status: number) {
  return status === upgradeRequiredStatus ? upgradeRequiredErrorCode : unexpectedError;
}
