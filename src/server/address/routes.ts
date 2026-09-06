import "server-only";

import {
  addressErrorCodes,
  addressQueryLength,
  isInsideServiceArea,
  type Coordinates,
} from "@/address/contract";
import { unauthorizedStatus } from "@/server/contract";
import { failureView } from "@/server/form";
import { readSession } from "@/server/session/session";

import {
  fetchAddressSuggestions,
  fetchCities,
  fetchCountries,
  fetchDistricts,
  isBackendId,
  resolveAddressCandidate,
  reverseAddressCandidate,
  startAddressSearchSession,
} from "./gateway";

/**
 * Adres ağ geçidinin tarayıcıya bakan yüzü.
 *
 * Arama her tuş vuruşunda çalışıyor, yani sunucu action'ı değil rota
 * işleyicisi gerekiyor: action'lar sırayla kuyruğa giriyor ve yalnız POST
 * kabul ediyor. Rota dosyaları bu işleyicileri çağırmaktan başka bir şey
 * yapmaz; mantık burada tek yerde durur ve tek yerden sınanır.
 *
 * Yanıt gövdesi hatalarda yalnız `errorCode` ve HTTP durumu taşır: backend'in
 * ham mesajı tarayıcıya hiç çıkmaz, metni istemci `errorPresentation` ile
 * seçer (`AGENTS.md`).
 */

/** `GlobalExceptionHandler` alan doğrulamasına bu kodu veriyor; aynısı kullanılır. */
const validationFailed = "VALIDATION_FAILED";

/** Zarfsız, önbelleğe alınmayan başarı yanıtı. */
function ok(data: unknown) {
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

function failed(errorCode: string, httpStatus: number) {
  return Response.json(
    { errorCode, httpStatus },
    { status: httpStatus, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Oturum bağlamı gerektiren uçların ortak kabuğu.
 *
 * Kapı önce çerezlere bakar: adres uçları backend'de `hasAnyRole("USER")`
 * arkasında ve tokensız istek 401 ile dönerdi. Ayrıca `apiRequest` render
 * sırasında oturumun bittiğini anlarsa `redirect` fırlatıyor; fetch ile
 * çağrılan bir uçta bu, tarayıcıya HTML giriş sayfası döndürürdü. Yönlendirme
 * niyeti burada 401'e çevrilir ki istemci bunu bir veri hatası gibi okusun.
 */
async function guarded(load: () => Promise<unknown>): Promise<Response> {
  const { refreshToken } = await readSession();
  if (!refreshToken) return failed("AUTHENTICATION_REQUIRED", unauthorizedStatus);
  return open(load);
}

/** Oturum gerektirmeyen uçların kabuğu; `/reference/**` backend'de açık. */
async function open(load: () => Promise<unknown>): Promise<Response> {
  try {
    return ok(await load());
  } catch (error) {
    if (isRedirect(error)) return failed("AUTHENTICATION_REQUIRED", unauthorizedStatus);
    const { errorCode, httpStatus } = failureView(error);
    return failed(errorCode, httpStatus);
  }
}

/** `next/navigation` yönlendirmeyi `digest` taşıyan bir hatayla bildiriyor. */
function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export function startSessionRoute(): Promise<Response> {
  return guarded(startAddressSearchSession);
}

export async function suggestionsRoute(request: Request, sessionId: string): Promise<Response> {
  if (!isBackendId(sessionId)) return failed(addressErrorCodes.sessionInvalid, 400);

  const query = (new URL(request.url).searchParams.get("query") ?? "").trim();
  // Sağlayıcı çağrısı ücretli ve oturuma bağlı: backend'in de reddedeceği
  // sorguyu buradan geçirmek boş yere bir arama oturumu harcardı. Denetim
  // oturum kapısından önce, çünkü sorgu uzunluğu oturum durumunu ele vermez.
  if (query.length < addressQueryLength.minimum || query.length > addressQueryLength.maximum) {
    return failed(addressErrorCodes.queryInvalid, 400);
  }

  return guarded(() => fetchAddressSuggestions(sessionId, query));
}

export function resolveRoute(sessionId: string, candidateId: string): Promise<Response> {
  if (!isBackendId(sessionId)) return Promise.resolve(failed(addressErrorCodes.sessionInvalid, 400));
  if (!isBackendId(candidateId)) {
    return Promise.resolve(failed(addressErrorCodes.candidateInvalid, 400));
  }

  return guarded(() => resolveAddressCandidate(sessionId, candidateId));
}

export async function reverseRoute(request: Request): Promise<Response> {
  const position = await readCoordinates(request);
  // Sağlayıcıya hiç sorulmadı: "adres bulunamadı" demek olan biteni yanlış
  // anlatırdı, gövde okunamadı.
  if (!position) return failed(validationFailed, 400);
  // Sınır dışı pin backend'de zaten 400; kullanıcıya aynı cevabı ağ turu
  // harcamadan vermek harita sürüklenirken fark edilir bir gecikme kapatıyor.
  if (!isInsideServiceArea(position)) return failed(addressErrorCodes.outsideServiceArea, 400);

  return guarded(() => reverseAddressCandidate(position));
}

export function countriesRoute(): Promise<Response> {
  return open(fetchCountries);
}

/** Kodlar `LocationMessages`'ten; `backend-error-codes` ikisini de tanıyor. */
export function citiesRoute(countryId: string): Promise<Response> {
  if (!isBackendId(countryId)) return Promise.resolve(failed("LOCATION_COUNTRY_NOTFOUND_ID", 404));
  return open(() => fetchCities(countryId));
}

export function districtsRoute(cityId: string): Promise<Response> {
  if (!isBackendId(cityId)) return Promise.resolve(failed("LOCATION_CITY_NOTFOUND_ID", 404));
  return open(() => fetchDistricts(cityId));
}

async function readCoordinates(request: Request): Promise<Coordinates | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }

  if (typeof body !== "object" || body === null) return null;
  const { latitude, longitude } = body as Record<string, unknown>;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}
