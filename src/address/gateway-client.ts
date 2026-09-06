import type {
  AddressCandidate,
  AddressSearchSession,
  AddressSuggestion,
  Coordinates,
  ReferenceLocation,
} from "./contract";

/**
 * Tarayıcının adres ağ geçidiyle konuştuğu tek yüzey.
 *
 * Adresler aynı origin'deki BFF uçları: `api.iskoala.com` ile doğrudan
 * konuşulmuyor (ADR-0011) ve sağlayıcı anahtarı istemciye hiç inmiyor.
 * Arayüz ayrı bir tip olarak duruyor ki bileşen testleri ağ katmanını
 * taklit edebilsin.
 */
export type AddressGateway = {
  startSession(): Promise<AddressSearchSession>;
  suggestions(sessionId: string, query: string): Promise<AddressSuggestion[]>;
  resolve(sessionId: string, candidateId: string): Promise<AddressCandidate>;
  reverse(position: Coordinates): Promise<AddressCandidate>;
  countries(): Promise<ReferenceLocation[]>;
  cities(countryId: string): Promise<ReferenceLocation[]>;
  districts(cityId: string): Promise<ReferenceLocation[]>;
};

/**
 * Ağ geçidinin reddettiği istek.
 *
 * Yalnız kod ve HTTP durumu taşır: backend'in ham metni BFF'te kalır,
 * kullanıcıya gösterilecek Türkçe `errorPresentation` ile seçilir.
 */
export class AddressGatewayError extends Error {
  readonly errorCode: string;
  readonly httpStatus: number;

  constructor(errorCode: string, httpStatus: number) {
    super(`Adres ağ geçidi isteği reddedildi: ${errorCode}`);
    this.name = "AddressGatewayError";
    this.errorCode = errorCode;
    this.httpStatus = httpStatus;
  }
}

const basePath = "/api/address";

export const browserAddressGateway: AddressGateway = {
  startSession: () => send<AddressSearchSession>("POST", `${basePath}/search-sessions`),
  suggestions: (sessionId, query) =>
    send<AddressSuggestion[]>(
      "GET",
      `${basePath}/search-sessions/${encodeURIComponent(sessionId)}/suggestions?${new URLSearchParams(
        { query },
      )}`,
    ),
  resolve: (sessionId, candidateId) =>
    send<AddressCandidate>(
      "POST",
      `${basePath}/search-sessions/${encodeURIComponent(sessionId)}/candidates/${encodeURIComponent(
        candidateId,
      )}/resolve`,
    ),
  reverse: (position) => send<AddressCandidate>("POST", `${basePath}/candidates/reverse`, position),
  countries: () => send<ReferenceLocation[]>("GET", `${basePath}/reference/countries`),
  cities: (countryId) =>
    send<ReferenceLocation[]>(
      "GET",
      `${basePath}/reference/countries/${encodeURIComponent(countryId)}/cities`,
    ),
  districts: (cityId) =>
    send<ReferenceLocation[]>(
      "GET",
      `${basePath}/reference/cities/${encodeURIComponent(cityId)}/districts`,
    ),
};

async function send<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      // Oturum çerezleri `HttpOnly`; istek onları taşımazsa uç 401 döner.
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // Ağ hiç kurulamadı: kullanıcıya gösterilecek metin yine koddan seçilsin
    // diye bağlantı hatası da aynı tipe çevrilir.
    throw new AddressGatewayError("UNEXPECTED", 0);
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const failure = payload as { errorCode?: unknown } | null;
    const errorCode = typeof failure?.errorCode === "string" ? failure.errorCode : "UNEXPECTED";
    throw new AddressGatewayError(errorCode, response.status);
  }

  return payload as T;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
