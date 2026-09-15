import { coordinateDecimals } from "@/address/contract";

/**
 * Konum süzgecinin ortak matematiği: adres çubuğundaki `konum` ve yarıçaptan
 * sınırlayıcı kutu. Kart metni `formatDistanceKm` ile biçimlenir; km değeri
 * backend `distanceKm`.
 *
 * `server-only` yok: sunucu sayfası sınırlayıcı kutuyu, istemcideki konum
 * düğmesi ise yazım biçimini kullanıyor. Ağ çağrısı ve gizli değer yok.
 *
 * Yarıçap hâlâ kutuya çevriliyor (`minLatitude`…); yakınlık sıralaması ve
 * kart mesafesi backend `lat`/`lng` + `sort=distance` ve `distanceKm` ile
 * geliyor (koala-backend#271, koala-web#164).
 */

export type GeoPoint = { readonly latitude: number; readonly longitude: number };

/** Adres çubuğunda sunulan yarıçaplar (km); mobil ile aynı basamaklar. */
export const distanceOptionsKm = [1, 3, 5, 10, 25] as const;

export type DistanceKm = (typeof distanceOptionsKm)[number];

export const defaultDistanceKm: DistanceKm = 5;

const earthRadiusKm = 6371.0088;
const kmPerLatitudeDegree = 111.32;

/** `konum=41.008238,28.978359`; iki ondalıktan az kesinlik de kabul. */
const pointPattern = /^(-?\d{1,2}(?:\.\d{1,6})?),(-?\d{1,3}(?:\.\d{1,6})?)$/;

export function parseGeoPoint(value: string | null | undefined): GeoPoint | null {
  if (!value) return null;
  const match = pointPattern.exec(value.trim());
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/** Adres çubuğuna yazılan biçim; altı ondalık `coordinateDecimals` ile aynı. */
export function formatGeoPoint(point: GeoPoint): string {
  return `${point.latitude.toFixed(coordinateDecimals)},${point.longitude.toFixed(coordinateDecimals)}`;
}

export function parseDistanceKm(value: string | null | undefined): DistanceKm | null {
  if (!value) return null;
  const parsed = Number(value);
  return distanceOptionsKm.find((option) => option === parsed) ?? null;
}

export type BoundingBox = {
  readonly minLatitude: number;
  readonly maxLatitude: number;
  readonly minLongitude: number;
  readonly maxLongitude: number;
};

/**
 * Merkez + yarıçaptan sınırlayıcı kutu. Kutu dairenin **üst kümesi**: köşedeki
 * bir ilan yarıçapın 1,41 katına kadar uzakta olabilir. Kart mesafeyi yazdığı
 * için kullanıcı bunu görüyor; kümeyi istemcide budamak "N ilan bulundu"
 * sayısını ekrandakiyle çelişir hâle getirirdi.
 */
export function boundingBoxAround(center: GeoPoint, radiusKm: number): BoundingBox {
  const latitudeDelta = radiusKm / kmPerLatitudeDegree;
  const cosine = Math.max(Math.cos(toRadians(center.latitude)), 0.01);
  const longitudeDelta = radiusKm / (kmPerLatitudeDegree * cosine);
  return {
    minLatitude: round(Math.max(center.latitude - latitudeDelta, -90)),
    maxLatitude: round(Math.min(center.latitude + latitudeDelta, 90)),
    minLongitude: round(Math.max(center.longitude - longitudeDelta, -180)),
    maxLongitude: round(Math.min(center.longitude + longitudeDelta, 180)),
  };
}

/** Haversine, km. Kartta iki ondalıklı konumlar için yeterli. */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Karttaki mesafe metni. ADR-0003: anonim ziyaretçiye giden koordinat iki
 * ondalığa yuvarlanmış bir bölge, yani "1,2 km" bir ölçüm değil bir tahmin.
 * Metin bunu "yaklaşık" ile söylüyor; kesin (`EXACT`) konumda da yuvarlama
 * var, çünkü kullanıcının kendi konumu da tarayıcıdan yaklaşık geliyor.
 */
export function formatDistanceKm(km: number): string {
  if (km < 1) return "1 km'den yakın";
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `yaklaşık ${rounded.toLocaleString("tr-TR")} km`;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function round(value: number): number {
  return Number(value.toFixed(coordinateDecimals));
}
