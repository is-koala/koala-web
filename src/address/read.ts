import {
  componentFields,
  roundCoordinate,
  type AddressComponents,
  type CanonicalAddress,
  type Coordinates,
} from "./contract";

/**
 * Backend `AddressDto`'sunu ekranın okuduğu biçime çevirir.
 *
 * Kimlik, sürüm ve `confirmedAt` görünümde yok: salt okunur kart onları
 * göstermiyor ve taşımak her çağıranı tam DTO'ya bağlardı.
 */
export function canonicalAddressFrom(value: unknown): CanonicalAddress | null {
  if (typeof value !== "object" || value === null) return null;
  const dto = value as Record<string, unknown>;

  return {
    countryName: typeof dto.countryName === "string" ? dto.countryName : "",
    cityName: typeof dto.cityName === "string" ? dto.cityName : "",
    districtName: typeof dto.districtName === "string" ? dto.districtName : "",
    components: componentsOf(dto.components),
    displayAddress: typeof dto.displayAddress === "string" ? dto.displayAddress : null,
    needsReview: dto.needsReview === true,
    position: coordinatesOf(dto.position),
  };
}

function componentsOf(value: unknown): AddressComponents {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const components: AddressComponents = {};
  for (const field of componentFields) {
    const text = source[field];
    if (typeof text === "string" && text.trim()) components[field] = text;
  }
  return components;
}

function coordinatesOf(value: unknown): Coordinates | null {
  if (typeof value !== "object" || value === null) return null;
  const latitude = numberOf((value as Record<string, unknown>).latitude);
  const longitude = numberOf((value as Record<string, unknown>).longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude) };
}

function numberOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
