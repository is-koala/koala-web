import "server-only";

import type {
  AddressCandidate,
  AddressSearchSession,
  AddressSuggestion,
  Coordinates,
  ReferenceLocation,
} from "@/address/contract";
import { roundCoordinate } from "@/address/contract";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

/**
 * Adres ağ geçidinin sunucu tarafı.
 *
 * Sağlayıcı anahtarı backend'de kaldığı için (ADR 0007) tarayıcı bu uçlara
 * doğrudan gidemiyor; BFF isteği oturum bağlamıyla iletir. Kimlikler
 * tarayıcıdan geldiği için yola konmadan önce UUID olduğu doğrulanır: aksi
 * hâlde `/locations/.../%2E%2E/auth/login` gibi bir değer backend'de başka
 * bir uca çözülürdü.
 */

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isBackendId(value: string): boolean {
  return uuidPattern.test(value);
}

/** `POST /locations/address-search-sessions`. */
export function startAddressSearchSession(): Promise<AddressSearchSession> {
  return apiRequest<AddressSearchSession>(backendPaths.addressSearchSessions, { method: "POST" });
}

/** `GET /locations/address-search-sessions/{sessionId}/suggestions`. */
export function fetchAddressSuggestions(
  sessionId: string,
  query: string,
): Promise<AddressSuggestion[]> {
  const search = new URLSearchParams({ query });
  return apiRequest<AddressSuggestion[]>(
    `${backendPaths.addressSearchSessions}/${sessionId}/suggestions?${search}`,
  );
}

/** `POST /locations/address-search-sessions/{sessionId}/candidates/{candidateId}/resolve`. */
export function resolveAddressCandidate(
  sessionId: string,
  candidateId: string,
): Promise<AddressCandidate> {
  return apiRequest<AddressCandidate>(
    `${backendPaths.addressSearchSessions}/${sessionId}/candidates/${candidateId}/resolve`,
    { method: "POST" },
  );
}

/**
 * `POST /locations/address-candidates/reverse`.
 *
 * Koordinat altı ondalığa yuvarlanarak gönderilir: `@Digits(fraction = 6)`
 * daha uzununu reddediyor ve dönen kanıt zaten yuvarlanmış konuma bağlanıyor.
 */
export function reverseAddressCandidate(position: Coordinates): Promise<AddressCandidate> {
  return apiRequest<AddressCandidate>(backendPaths.addressCandidateReverse, {
    method: "POST",
    body: {
      latitude: roundCoordinate(position.latitude),
      longitude: roundCoordinate(position.longitude),
    },
  });
}

/** `GET /reference/countries`; sağlayıcı düştüğünde elle seçim yedeği. */
export function fetchCountries(): Promise<ReferenceLocation[]> {
  return apiRequest<ReferenceLocation[]>(backendPaths.referenceCountries);
}

export function fetchCities(countryId: string): Promise<ReferenceLocation[]> {
  return apiRequest<ReferenceLocation[]>(
    `${backendPaths.referenceCountries}/${countryId}/cities`,
  );
}

export function fetchDistricts(cityId: string): Promise<ReferenceLocation[]> {
  return apiRequest<ReferenceLocation[]>(`${backendPaths.referenceCities}/${cityId}/districts`);
}
