import {
  componentFields,
  componentLimits,
  isInsideServiceArea,
  roundCoordinate,
  serviceAreaNotice,
  type AddressComponents,
  type AddressDraft,
  type AddressWrite,
} from "./contract";

/**
 * Taslağı `AddressWriteV2` gövdesine çevirir; tamamlanmamışsa `null`.
 *
 * Gövde beyaz listeyle kuruluyor, taslaktan kopyalanmıyor: `AddressWriteDto`
 * bilinmeyen alanı `rejectUnknownField` ile 400'e çeviriyor, yani taslağa
 * eklenen her yeni alan aksi hâlde bütün adres yazmalarını kırardı.
 */
export function addressWriteBody(draft: AddressDraft): AddressWrite | null {
  if (Object.keys(addressDraftErrors(draft)).length > 0) return null;
  if (!draft.country || !draft.city || !draft.district || !draft.position) return null;

  const body: AddressWrite = {
    countryId: draft.country.id,
    cityId: draft.city.id,
    districtId: draft.district.id,
    components: writeComponents(draft),
    position: {
      latitude: roundCoordinate(draft.position.latitude),
      longitude: roundCoordinate(draft.position.longitude),
      source: draft.source,
    },
  };

  // Kanıt yalnız sağlayıcının doğruladığı konuma ait. Kullanıcı pini elle
  // taşıdıysa `verifyAndConsume` token taşıyan gövdeyi doğrudan reddediyor.
  const token = draft.candidateToken?.trim();
  if (draft.source !== "USER_CONFIRMED_PIN" && token) {
    body.candidateToken = token;
  }

  return body;
}

/**
 * Alan bazlı Türkçe hatalar; anahtarlar backend DTO alan adlarıyla aynı.
 *
 * İstemci doğrulaması backend'i tekrarlıyor ama onun yerini almıyor:
 * kullanıcı formu göndermeden önce eksiğini görsün diye var, son söz
 * `AddressWriteDto` doğrulamasında.
 */
export function addressDraftErrors(draft: AddressDraft): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!draft.country) errors.countryId = "Ülke seçmelisin.";
  if (!draft.city) errors.cityId = "İl seçmelisin.";
  if (!draft.district) errors.districtId = "İlçe seçmelisin.";

  const components = draft.components;
  if (!components.neighborhood.trim()) errors.neighborhood = "Mahalle zorunlu.";
  if (!components.thoroughfare.trim()) errors.thoroughfare = "Cadde veya sokak zorunlu.";
  if (!/^\d{5}$/.test(components.postalCode.trim())) {
    errors.postalCode = "Posta kodu 5 haneli olmalı.";
  }
  // `isLocationDetailPresent`: kapı numarası olmayan iş yerleri için site adı
  // yeterli sayılıyor, ama ikisi birden boş bırakılamıyor.
  if (!components.buildingNumber.trim() && !components.siteName.trim()) {
    errors.buildingNumber = "Bina numarası ya da site/tesis adı zorunlu.";
  }

  for (const field of componentFields) {
    if (components[field].trim().length > componentLimits[field]) {
      errors[field] = `En fazla ${componentLimits[field]} karakter olabilir.`;
    }
  }

  if (!draft.position) {
    errors.position = "Konumu onaylaman gerekiyor.";
  } else if (!isInsideServiceArea(draft.position)) {
    errors.position = serviceAreaNotice;
  }

  return errors;
}

/**
 * Form gövdesinde taşınan adresi okur.
 *
 * Form bir gizli alanla gidiyor: `useActionState` ile çalışan sunucu
 * action'ları `FormData` alıyor ve iç içe bir nesne düz alanlara
 * dağıtıldığında hangi alanın sözleşmeye ait olduğu kaybolurdu. Sunucu
 * gövdeyi yine de tarayıcıdan geldiği için yeniden süzer.
 */
export function readAddressWrite(formData: FormData, name = "address"): AddressWrite | null {
  const raw = formData.get(name);
  if (typeof raw !== "string" || !raw) return null;

  try {
    return sanitizeWrite(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Yalnız sözleşmedeki alanları geçiren süzgeç; fazlası düşer. */
function sanitizeWrite(value: unknown): AddressWrite | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;

  const draft: AddressDraft = {
    country: referenceOf(candidate.countryId),
    city: referenceOf(candidate.cityId),
    district: referenceOf(candidate.districtId),
    components: componentsDraftOf(candidate.components),
    position: coordinatesOf(candidate.position),
    source: sourceOf(candidate.position),
    candidateToken: typeof candidate.candidateToken === "string" ? candidate.candidateToken : null,
    attribution: null,
    needsReview: false,
  };

  return addressWriteBody(draft);
}

function referenceOf(value: unknown) {
  return typeof value === "string" && value ? { id: value, name: "" } : null;
}

function componentsDraftOf(value: unknown) {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    componentFields.map((field) => [
      field,
      typeof source[field] === "string" ? source[field] : "",
    ]),
  ) as AddressDraft["components"];
}

function coordinatesOf(value: unknown) {
  if (typeof value !== "object" || value === null) return null;
  const position = value as Record<string, unknown>;
  if (typeof position.latitude !== "number" || typeof position.longitude !== "number") return null;
  if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) return null;
  return { latitude: position.latitude, longitude: position.longitude };
}

function sourceOf(value: unknown): AddressDraft["source"] {
  const position = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return position.source === "AUTOCOMPLETE_CONFIRMED" ||
    position.source === "REVERSE_GEOCODE_CONFIRMED"
    ? position.source
    : "USER_CONFIRMED_PIN";
}

/** Boş bırakılan bileşen gövdeye hiç girmez; backend boş dizeyi kayıt sayardı. */
function writeComponents(draft: AddressDraft): AddressComponents {
  const components: AddressComponents = {};
  for (const field of componentFields) {
    const value = draft.components[field].trim();
    if (value) components[field] = value;
  }
  return components;
}

/**
 * `PUT /users/me/address` alan hataları. Gövde kök DTO olduğu için
 * `components.postalCode` gibi yollar formun düz alan adına kırpılır.
 */
export function writeFieldErrors(
  fieldErrors: Readonly<Record<string, string>>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, message] of Object.entries(fieldErrors)) {
    const name = field.startsWith("components.")
      ? field.slice("components.".length)
      : field.startsWith("position.")
        ? "position"
        : field;
    errors[name] = message;
  }
  return errors;
}
