/**
 * Adres ağ geçidinin istemciyle paylaşılan sözleşmesi.
 *
 * Backend `AddressWriteV2` (`AddressWriteDto`) gövdesini bilinmeyen alan
 * geldiğinde sessizce budamıyor, isteği reddediyor; sınırlar ve alan adları
 * bu yüzden tek dosyada toplanır. Dosya sunucuya kilitli değil: hizmet alanı
 * ve konum kaynağı hem BFF hem tarayıcı tarafında okunuyor (harita seçici
 * is-koala/koala-web#28 aynı sabitleri kullanacak).
 */

/**
 * `ConfirmedPositionSource`. Konumun kim tarafından onaylandığını söyler.
 *
 * Yalnız yazma yönü: yanıt tarafındaki `AddressPositionSource` ayrıca
 * `LEGACY_UNVERIFIED` taşıyor ve o değer gövdeye konamaz. Kayıtlı bir adres
 * taslağa dönüştürülürken konum yeniden onaylatılmalı.
 */
export type PositionSource =
  | "AUTOCOMPLETE_CONFIRMED"
  | "REVERSE_GEOCODE_CONFIRMED"
  | "USER_CONFIRMED_PIN";

/**
 * `IstanbulServiceArea`. Backend dışarıdaki her konumu reddettiği için
 * istemci de aynı dikdörtgeni bilir; kullanıcı sınır dışına çıkan bir pini
 * göndermeden önce uyarılır.
 */
export const istanbulServiceArea = {
  south: 40.8,
  west: 28.55,
  north: 41.35,
  east: 29.5,
} as const;

/** Sultanahmet. Harita seçici (#28) kamerayı buradan açacak. */
export const defaultMapCenter = { latitude: 41.008238, longitude: 28.978359 } as const;

/**
 * `@Digits(fraction = 6)` ve `BigDecimal.setScale(6)`. Daha uzun bir ondalık
 * hem doğrulamaya takılır hem de tek kullanımlık aday kanıtının koordinat
 * eşleşmesini bozar.
 */
export const coordinateDecimals = 6;

/**
 * Oturum yenileme payı.
 *
 * Tam süre dolduğunda yenilemek, yolda olan bir sorgunun backend'e süresi
 * dolmuş bir oturumla varmasına izin verirdi; o tur boşa gider ve saydam
 * yeniden açma bir gecikme daha ekler.
 */
export const sessionRenewalMarginMs = 5_000;

/** `AddressSearchManager.MINIMUM_QUERY_LENGTH` / `MAXIMUM_QUERY_LENGTH`. */
export const addressQueryLength = { minimum: 3, maximum: 160 } as const;

/** `AddressComponentsRequestDto` alan sınırları. */
export const componentLimits = {
  neighborhood: 120,
  thoroughfare: 160,
  siteName: 120,
  block: 40,
  buildingName: 120,
  buildingNumber: 30,
  floor: 20,
  unitNumber: 30,
  postalCode: 5,
  additionalDirections: 500,
} as const;

/** Gövdeye giren bileşen alanları; sıraları backend DTO'sundaki sırayla aynı. */
export const componentFields = [
  "neighborhood",
  "thoroughfare",
  "siteName",
  "block",
  "buildingName",
  "buildingNumber",
  "floor",
  "unitNumber",
  "postalCode",
  "additionalDirections",
] as const;

export type ComponentField = (typeof componentFields)[number];

/**
 * Ağ geçidinin dallanma yaptığı hata kodları.
 *
 * Metne göre değil koda göre karar verilir (`AGENTS.md`); kullanıcıya
 * gösterilecek Türkçe metin `@/lib/errors` içindeki `errorPresentation`
 * tarafından seçilir.
 */
export const addressErrorCodes = {
  candidateInvalid: "ADDRESS_SEARCHCANDIDATE_INVALID",
  candidateTokenInvalid: "ADDRESS_CANDIDATETOKEN_INVALID",
  outsideServiceArea: "ADDRESS_SEARCHCANDIDATE_OUTSIDESERVICEAREA",
  providerUnavailable: "ADDRESS_SEARCHPROVIDER_UNAVAILABLE",
  queryInvalid: "ADDRESS_SEARCHQUERY_INVALID",
  reverseNoResult: "ADDRESS_REVERSE_NORESULT",
  sessionInvalid: "ADDRESS_SEARCHSESSION_INVALID",
} as const;

/** `AddressSearchSessionDto`. */
export type AddressSearchSession = {
  id: string;
  /** ISO 8601; oturum bu andan sonra backend'de yok sayılır. */
  expiresAt: string;
};

/** `AddressSuggestionDto`. */
export type AddressSuggestion = {
  id: string;
  mainText: string;
  secondaryText: string;
};

/** Yazma yönünde gönderilen bileşenler; boş bırakılan alan gövdeye girmez. */
export type AddressComponents = Partial<Record<ComponentField, string>>;

export type Coordinates = { latitude: number; longitude: number };

export type AddressPosition = Coordinates & { source: PositionSource };

/** `AddressCandidateDto`. `candidateToken` tek kullanımlık kanıttır. */
export type AddressCandidate = {
  countryId: string;
  countryName: string;
  countryCode: string;
  cityId: string;
  cityName: string;
  districtId: string;
  districtName: string;
  components: AddressComponents;
  position: AddressPosition;
  candidateToken: string;
  needsUserReview: boolean;
  attribution: string;
};

/** `AddressWriteV2` gövdesinin birebir karşılığı. */
export type AddressWrite = {
  countryId: string;
  cityId: string;
  districtId: string;
  components: AddressComponents;
  position: AddressPosition;
  candidateToken?: string;
};

/**
 * `AddressDto`'nun okunması gereken parçası.
 *
 * Salt okunur görünüm kaydın kimliğini ya da sürümünü göstermiyor; buraya
 * yalnız ekrana çıkan alanlar giriyor ki çağıranlar tam DTO'yu taşımak
 * zorunda kalmasın.
 */
export type CanonicalAddress = {
  countryName: string;
  cityName: string;
  districtName: string;
  components: AddressComponents;
  /** Backend'in biçimlendirdiği tek satır; yoksa bileşenlerden kurulur. */
  displayAddress: string | null;
  needsReview: boolean;
};

/** `/reference` uçlarının döndürdüğü ülke, il ve ilçe kaydı. */
export type ReferenceLocation = {
  id: string;
  name: string;
  code?: string;
};

/** Bileşen alanlarının düzenlenebilir hâli; her alan metin kutusuna bağlı. */
export type AddressComponentsDraft = Record<ComponentField, string>;

/**
 * Formun tuttuğu durum.
 *
 * Gövdeden farkı, henüz tamamlanmamış olabilmesi: kullanıcı alanları
 * doldururken taslak geçersiz kalır ve `addressWriteBody` `null` döner.
 */
export type AddressDraft = {
  country: ReferenceLocation | null;
  city: ReferenceLocation | null;
  district: ReferenceLocation | null;
  components: AddressComponentsDraft;
  position: Coordinates | null;
  source: PositionSource;
  /** Yalnız sağlayıcıdan gelen konumlarda dolu; elle taşınan pinde düşer. */
  candidateToken: string | null;
  /** Sağlayıcı şartı: aday ekranda görünürken kaynağı da görünmeli. */
  attribution: string | null;
  /** `needsUserReview`: aday eksik geldi, kullanıcı açıkça onaylamalı. */
  needsReview: boolean;
};

const emptyComponents: AddressComponentsDraft = {
  neighborhood: "",
  thoroughfare: "",
  siteName: "",
  block: "",
  buildingName: "",
  buildingNumber: "",
  floor: "",
  unitNumber: "",
  postalCode: "",
  additionalDirections: "",
};

/**
 * Kullanıcı hiçbir şey seçmemişken taslak. Konum kaynağı en kısıtlı değerle
 * başlar: kanıtı olmayan bir konum ancak kullanıcının kendi onayıdır.
 */
export const emptyAddressDraft: AddressDraft = {
  country: null,
  city: null,
  district: null,
  components: emptyComponents,
  position: null,
  source: "USER_CONFIRMED_PIN",
  candidateToken: null,
  attribution: null,
  needsReview: false,
};

/**
 * Hizmet alanı dışına düşen konumun kullanıcıya açıklaması.
 *
 * Backend aynı durumu 400 ile bildiriyor ama ham metni ekrana çıkmıyor; aynı
 * cümle hem istemcide yakalanan hâlde hem `errorPresentation` içinde geçtiği
 * için burada tek kaynaktan okunur.
 */
export const serviceAreaNotice = "Koala şu anda yalnızca İstanbul'da hizmet veriyor.";

/** `BigDecimal.setScale(6, HALF_UP)` ile aynı ölçek. */
export function roundCoordinate(value: number): number {
  const factor = 10 ** coordinateDecimals;
  return Math.round(value * factor) / factor;
}

export function isInsideServiceArea(position: Coordinates): boolean {
  return (
    position.latitude >= istanbulServiceArea.south &&
    position.latitude <= istanbulServiceArea.north &&
    position.longitude >= istanbulServiceArea.west &&
    position.longitude <= istanbulServiceArea.east
  );
}

