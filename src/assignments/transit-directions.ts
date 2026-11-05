/**
 * İş adresine toplu taşımayla yol tarifi (is-koala/koala-web#178).
 *
 * Karar: uygulama içinde rota çizilmiyor, toplu taşıma verisi tutulmuyor;
 * harici haritaya API anahtarı gerektirmeyen evrensel bağlantı veriliyor
 * (Directions API ücretli ve sonucu Google haritasında gösterme şartı var).
 *
 * - Google: Maps URLs `api=1`, `travelmode=transit`.
 * - Apple: Apple Map Links, `daddr` + `dirflg=r` (toplu taşıma).
 *
 * İkisi de varış saati taşımıyor (`api=1` belgelenmiş parametreleri arasında
 * zaman yok; Apple Map Links'te de yok). Belgelenmemiş bir parametre
 * eklenmiyor; iş başlangıcı bağlantının yanında yazılıyor ve kullanıcı varış
 * saatini haritada seçiyor. Başlangıç noktası da yok: harita bulunduğun yeri
 * kendisi soruyor, kullanıcının konumu web'den hiçbir yere gitmiyor.
 *
 * Koordinat yalnız `EXACT` adresten gelir (ADR-0003); kararı çağıran verir.
 */
export type TransitDirections = {
  readonly google: string;
  readonly apple: string;
};

type Position = { latitude?: unknown; longitude?: unknown } | null | undefined;

export function transitDirections(position: Position): TransitDirections | null {
  const latitude = coordinate(position?.latitude, 90);
  const longitude = coordinate(position?.longitude, 180);
  if (latitude === null || longitude === null) return null;

  const destination = `${latitude},${longitude}`;
  return {
    google: `https://www.google.com/maps/dir/?${new URLSearchParams({
      api: "1",
      destination,
      travelmode: "transit",
    })}`,
    apple: `https://maps.apple.com/?${new URLSearchParams({ daddr: destination, dirflg: "r" })}`,
  };
}

/** Altı ondalık (~11 cm); bilimsel gösterime (`1e-7`) düşmeden sayı metni. */
function coordinate(value: unknown, limit: number): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > limit) return null;
  const rounded = Math.round(value * 1e6) / 1e6;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}
