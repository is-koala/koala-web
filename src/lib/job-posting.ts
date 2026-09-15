/**
 * İlan açmanın istemci tarafındaki kuralları.
 *
 * Sunucuya kilitli değil: aynı kurallar hem tarayıcıdaki çok adımlı formda hem
 * de gönderimi karşılayan sunucu action'ında okunuyor. İkisi ayrı yazılsaydı
 * form kabul ettiği bir gövdeyi sunucuya reddettirebilirdi.
 *
 * Bireysel ve şirket ilanı aynı dosyada, çünkü backend'de de aynı gövdenin iki
 * hâliler (`CreateIndividualJobDto` / `CreateCompanyJobDto`) ve ayrıldıkları
 * yer sayılabilir kadar az: sigorta. İki ayrı modül, birinde düzeltilen bir
 * kuralı öbüründe eskitirdi.
 *
 * Alan adları DTO alan adlarıyla birebir aynı: backend alan hatalarını
 * `details[].field` ile bildiriyor ve `fieldError(state, ad)` o adla okunuyor;
 * bir dönüştürme katmanı iki tarafı sessizce ayırırdı.
 */

import type { AddressWrite } from "@/address/contract";

/** `JobType`. */
export const jobTypeValues = ["ONE_TIME", "RECURRING"] as const;
export type JobType = (typeof jobTypeValues)[number];

/**
 * `SalaryType`. Bireysel ilanda saatlik ve günlük dışında bir değer yok.
 *
 * Üç taraf okuyor: ilan formu, ilan aramasının `ucret-tipi` süzgeci ve yanıt
 * çeviricisinin beyaz listesi (`@/server/api/dto`). Kopyalarından biri
 * genişletildiğinde öbürleri sessizce eski kalır ve aynı enum ekranın üç
 * yerinde farklı okunurdu.
 */
export const salaryTypeValues = ["HOURLY", "DAILY"] as const;
export type SalaryType = (typeof salaryTypeValues)[number];

/**
 * `PricingBreakdownDto`.
 *
 * Bütün tutarlar **dize**, ve bu DTO'nun kendi kararı: istemcinin backend
 * yuvarlamasını kayan noktayla yeniden üretmesi istenmiyor. Bu yüzden burada
 * hiçbir alan `number` değil — bir kez sayıya çevrilse ekrana çıkan kuruş
 * backend'in kilitlediğinden ayrılabilirdi.
 */
export type PricingBreakdown = {
  pricingVersion: string;
  currency: string;
  workerPayout: string;
  serviceFeeRate: string;
  serviceFeeAmount: string;
  employerTotal: string;
};

/**
 * Fiyat önizlemesinin sonucu.
 *
 * `FormState` değil, çünkü bu bir form gönderimi değil: kullanıcı ücreti
 * yazıyor ve yayımlamadan önce dökümü görüyor. Hata yalnız kod ve durum
 * taşıyor; ekrandaki Türkçe metni `errorPresentation` seçiyor.
 */
export type PriceQuoteResult =
  | { status: "ready"; breakdown: PricingBreakdown }
  | { status: "error"; errorCode: string; httpStatus: number };

/** `JobCategoryDto`. `requiresInsurance` bireysel ilanı doğrudan reddettiriyor. */
export type JobCategory = {
  id: string;
  name: string;
  code: string;
  requiresInsurance: boolean;
};

/**
 * Formun tuttuğu ham değerler.
 *
 * Hepsi metin, çünkü hepsi bir input'un değeri: sayıya ya da tarihe çevirme
 * yalnız gövde kurulurken bir kez yapılıyor ve yarım yazılmış bir sayı
 * taslakta `NaN`'a dönüşmüyor.
 *
 * Tek taslak, iki uç: alanların hepsi `CreateIndividualJobDto` ile
 * `CreateCompanyJobDto`'da ortak. Gövdeyi taslaktan **beyaz listeyle** kuran
 * `individualJobBody` bireysel uca ait olmayan hiçbir alanı taşımıyor.
 */
export type JobDraft = {
  categoryId: string;
  title: string;
  description: string;
  sector: string;
  position: string;
  duties: string;
  dressCode: string;
  type: string;
  salaryType: string;
  salary: string;
  startDateTime: string;
  endDateTime: string;
  minAge: string;
  maxAge: string;
  /** `"true"` · `"false"` · `""`; `@NotNull` olduğu için boş bırakılamaz. */
  experienceRequired: string;
  /** `@Min(1)` ama zorunlu değil: boş bırakılırsa gövdeye hiç girmez. */
  headcount: string;
  /**
   * İşverenin sigorta **tercihi** — gövdeye giden değer bu değil.
   *
   * Adı bilerek `insuranceRequired` değil: gönderilen değeri
   * `insuranceRequiredFor(...)` kategoriden türetiyor ve bu alanı yalnız
   * kategori sigortayı zorunlu kılmadığında okuyor. İki ad aynı olsaydı bir
   * çağıranın taslaktaki alanı doğrudan gövdeye koyması kuralı sessizce
   * devre dışı bırakırdı — koala-mobile#24'ü doğuran şey tam olarak buydu.
   *
   * Bireysel ilanda hiç okunmuyor: `CreateIndividualJobDto` sigorta alanı
   * taşımıyor ve sunucu değeri `false` sabitliyor (`JobManager.java:153`).
   */
  insurancePreference: string;
};

export const emptyJobDraft: JobDraft = {
  categoryId: "",
  title: "",
  description: "",
  sector: "",
  position: "",
  duties: "",
  dressCode: "",
  type: "",
  salaryType: "",
  salary: "",
  startDateTime: "",
  endDateTime: "",
  minAge: "",
  maxAge: "",
  experienceRequired: "",
  headcount: "",
  insurancePreference: "",
};

/**
 * `@DecimalMin("1.00")` ve `@Min(1)`; kuruş iki hanede biter (§2e, ölçek 2).
 *
 * Fiyat önizlemesi de aynı kalıbı okuyor: backend'in reddedeceği bir tutar
 * için ağ turu atmak, kullanıcıya aynı cevabı daha geç vermek olurdu.
 */
export const moneyPattern = /^\d+(\.\d{1,2})?$/;
const wholeNumberPattern = /^\d+$/;

/**
 * Bireysel ilanın alan bazlı Türkçe hataları; anahtarlar DTO alan adlarıyla
 * aynı.
 *
 * Şirket ilanından tek farkı sigorta dalı: `JobManager.java:134-137` sigorta
 * zorunlu bir kategoride bireysel ilanı koşulsuz reddediyor. Kullanıcıyı formu
 * doldurduktan sonra öğrenmeye bırakmak akışı çökertirdi.
 */
export function individualJobErrors(
  draft: JobDraft,
  categories: readonly JobCategory[] | null,
): Record<string, string> {
  const errors = commonJobErrors(draft, categories);

  // Kategoriye ait başka bir hata varsa üzerine yazılmıyor: "kategori seçilmedi"
  // ile "bu kategori bireysele kapalı" ayrı şeyler ve ilki daha önce geliyor.
  if (errors.categoryId === undefined && selectedCategory(categories, draft)?.requiresInsurance) {
    errors.categoryId = "Bu kategori sigorta zorunluluğu taşıyor, bireysel ilanla açılamaz.";
  }

  return errors;
}

/**
 * Şirket ilanının alan bazlı hataları.
 *
 * Sigorta zorunlu kategori burada bir hata **değil**:
 * `JobManager.createCorporateJob` (`:201-204`) o kategoriyi kabul ediyor ve
 * yalnız `insuranceRequired=true` istiyor. Koşulu forma bir hata olarak değil,
 * `insuranceRequiredFor(...)` ile türetilen bir değer olarak yazıyoruz —
 * kullanıcının kapatabileceği bir anahtar bırakmak, sunucunun reddedeceği
 * gövdeyi göndermeye izin vermek olurdu.
 *
 * `commonJobErrors`'a ince bir sarmalayıcı, ama çağıranların ortak listeyi
 * doğrudan okumasını istemiyoruz: iki uç bir gün başka bir yerde de ayrılırsa
 * o fark bu işlevin içinde durmalı.
 */
export function companyJobErrors(
  draft: JobDraft,
  categories: readonly JobCategory[] | null,
): Record<string, string> {
  return commonJobErrors(draft, categories);
}

/**
 * İki ilan türünün ortak alan kuralları.
 *
 * İstemci doğrulaması backend'i tekrarlamıyor, iki boşluğu kapatıyor:
 * kullanıcı eksiğini göndermeden önce görüyor, ve `endDateTime > startDateTime`
 * kuralının **tek** uygulayıcısı burası — iki DTO da yalnız yaş sırasını
 * denetliyor, tarih sırasını hiç denetlemiyor.
 */
function commonJobErrors(
  draft: JobDraft,
  categories: readonly JobCategory[] | null,
): Record<string, string> {
  const errors: Record<string, string> = {};

  // Katalog `null` ise "okunamadı" demek, "boş" demek değil: kategoriye bağlı
  // kurallar denetlenemez ve son söz backend'e kalır. Boş liste ile
  // karıştırılsaydı katalog düştüğünde hiçbir kategori seçilemez görünürdü.
  const category = selectedCategory(categories, draft);
  if ((categories !== null && !category) || !draft.categoryId.trim()) {
    errors.categoryId = "Bir iş kategorisi seçmelisin.";
  }

  if (!draft.title.trim()) errors.title = "İlan başlığı zorunlu.";
  if (!draft.description.trim()) errors.description = "İlan açıklaması zorunlu.";
  if (!draft.position.trim()) errors.position = "Pozisyon zorunlu.";

  if (!jobTypeValues.includes(draft.type as JobType)) {
    errors.type = "İlan türünü seçmelisin.";
  }
  if (!salaryTypeValues.includes(draft.salaryType as SalaryType)) {
    errors.salaryType = "Ücret türünü seçmelisin.";
  }

  const salary = draft.salary.trim();
  if (!moneyPattern.test(salary) || Number(salary) < 1) {
    errors.salary = "Ücret en az 1 olmalı ve en fazla iki ondalık taşıyabilir.";
  }

  const start = timestampOf(draft.startDateTime);
  const end = timestampOf(draft.endDateTime);
  if (start === null) errors.startDateTime = "Başlangıç tarihini seçmelisin.";
  if (end === null) {
    errors.endDateTime = "Bitiş tarihini seçmelisin.";
  } else if (start !== null && end <= start) {
    errors.endDateTime = "Bitiş tarihi başlangıçtan sonra olmalı.";
  }

  const minAge = ageOf(draft.minAge);
  const maxAge = ageOf(draft.maxAge);
  if (minAge === null) errors.minAge = "En küçük yaş en az 1 olmalı.";
  if (maxAge === null) {
    errors.maxAge = "En büyük yaş en az 1 olmalı.";
  } else if (minAge !== null && maxAge < minAge) {
    errors.maxAge = "En büyük yaş, en küçük yaştan küçük olamaz.";
  }

  if (draft.experienceRequired !== "true" && draft.experienceRequired !== "false") {
    errors.experienceRequired = "Deneyim koşulunu seçmelisin.";
  }

  const headcount = draft.headcount.trim();
  if (headcount && (!wholeNumberPattern.test(headcount) || Number(headcount) < 1)) {
    errors.headcount = "Kişi sayısı en az 1 olmalı; boş bırakabilirsin.";
  }

  return errors;
}

/**
 * İki uçta da aynı olan gövde alanları.
 *
 * `addressPublic` **yok**: bireysel DTO onu hiç taşımıyor, şirket DTO'su
 * taşıyor ama sunucu alan gelmediğinde `false` yazıyor (primitive `boolean`).
 * İşyeri adresini herkese açmak ayrı bir ürün kararı ve bu dilimde forma
 * girmiyor; gövde tipinin onu kabul etmemesi, kararı vermeden alanı
 * göndermeyi imkânsız kılıyor.
 */
type SharedJobBody = {
  categoryId: string;
  title: string;
  description: string;
  sector?: string;
  position: string;
  duties?: string;
  dressCode?: string;
  address: AddressWrite;
  type: JobType;
  salaryType: SalaryType;
  /**
   * Ondalık dize.
   *
   * Para `BigDecimal`, ölçek 2 (koala-backend `CLAUDE.md` §2e) ve Jackson
   * dizeyi doğrudan `BigDecimal`'e çeviriyor. Sayıya çevirip göndermek,
   * kullanıcının yazdığı kuruşu bir kayan nokta turundan geçirirdi.
   */
  salary: string;
  startDateTime: string;
  endDateTime: string;
  minAge: number;
  maxAge: number;
  experienceRequired: boolean;
  headcount?: number;
};

/**
 * `POST /users/me/jobs` gövdesi — `CreateIndividualJobDto`.
 *
 * Ortak alanlardan **ibaret**: DTO sigorta alanı taşımıyor ve sunucu değeri
 * `false` sabitliyor (`JobManager.java:153`). Forma sigorta anahtarı konmasın
 * diye gövde tipi de onu kabul etmiyor.
 */
export type CreateIndividualJobBody = SharedJobBody;

/**
 * `POST /companies/{companyId}/jobs` gövdesi — `CreateCompanyJobDto`.
 *
 * Bireyselden tek farkı `insuranceRequired` ve **isteğe bağlı değil**:
 * `@NotNull`, yani alan gövdeye hiç girmezse ilan alan doğrulamasına takılır.
 */
export type CreateCompanyJobBody = SharedJobBody & {
  insuranceRequired: boolean;
};

/**
 * Bu ilanda sigorta koşulunun kullanıcı tarafından kapatılamayacağı.
 *
 * Kategoriden okunuyor ve **saklanmıyor**: kategoriyi değiştiren her yolun
 * (seçici, şablon, geri yüklenen taslak) senkron tutulan bir alanı güncellemeyi
 * hatırlaması gerekseydi biri unutulduğunda kural sessizce düşerdi —
 * koala-mobile#24 tam olarak böyle doğdu.
 *
 * Katalog okunamadığında (`null`) kilit yok: bilinmeyeni kilitli saymak,
 * kategori listesi düştüğünde her ilanı sigortalıya çevirirdi.
 */
export function insuranceLocked(
  categories: readonly JobCategory[] | null,
  categoryId: string,
): boolean {
  return categories?.find((candidate) => candidate.id === categoryId)?.requiresInsurance === true;
}

/**
 * Şirket ilanının gövdesine girecek sigorta değeri.
 *
 * `JobManager.java:201-204` sigorta zorunlu bir kategoride `insuranceRequired`
 * `true` değilse ilanı 400 ile geri çeviriyor. Kilitli değilken işverenin
 * kendi tercihi geçerli: sunucu zorunlu kılmadığı bir işte de sigortayı kabul
 * ediyor.
 *
 * Katalog okunamadığında tercih olduğu gibi taşınıyor ve son söz backend'e
 * kalıyor: bilinmeyeni `true` saymak, işverenin hiç kabul etmediği bir
 * yükümlülüğü ilana yazardı.
 */
export function insuranceRequiredFor(
  categories: readonly JobCategory[] | null,
  categoryId: string,
  preference: string,
): boolean {
  return insuranceLocked(categories, categoryId) || preference === "true";
}

/**
 * Bireysel ilan gövdesi; kurallardan biri bile ihlal edilmişse `null`.
 *
 * Adres **dışarıdan** geliyor ve olduğu gibi taşınıyor: kanonik adres bileşeni
 * (is-koala/koala-web#27) `AddressWriteV2` gövdesini hazır veriyor ve
 * `AddressWriteDto.java:43-46` bilinmeyen her alanı `REQUEST_MALFORMED`'a
 * çeviriyor — üzerine tek bir alan eklemek bütün gönderimi çöpe atardı.
 */
export function individualJobBody(
  draft: JobDraft,
  address: AddressWrite | null,
  categories: readonly JobCategory[] | null,
): CreateIndividualJobBody | null {
  return sharedJobBody(draft, address, individualJobErrors(draft, categories));
}

/**
 * Şirket ilanı gövdesi; kurallardan biri bile ihlal edilmişse `null`.
 *
 * Sigorta değeri taslaktan **kopyalanmıyor**, kategoriden türetiliyor: gövdeyi
 * kuran tek yer burası olduğu için kilitli bir kategoride kapalı bir tercihle
 * gönderim yapılamıyor.
 */
export function companyJobBody(
  draft: JobDraft,
  address: AddressWrite | null,
  categories: readonly JobCategory[] | null,
): CreateCompanyJobBody | null {
  const shared = sharedJobBody(draft, address, companyJobErrors(draft, categories));
  if (shared === null) return null;

  return {
    ...shared,
    insuranceRequired: insuranceRequiredFor(categories, draft.categoryId, draft.insurancePreference),
  };
}

function sharedJobBody(
  draft: JobDraft,
  address: AddressWrite | null,
  errors: Record<string, string>,
): SharedJobBody | null {
  if (address === null) return null;
  if (Object.keys(errors).length > 0) return null;

  const body: SharedJobBody = {
    categoryId: draft.categoryId,
    title: draft.title.trim(),
    description: draft.description.trim(),
    position: draft.position.trim(),
    address,
    type: draft.type as JobType,
    salaryType: draft.salaryType as SalaryType,
    salary: quotedWorkerPayout(draft),
    startDateTime: draft.startDateTime,
    endDateTime: draft.endDateTime,
    minAge: Number(draft.minAge.trim()),
    maxAge: Number(draft.maxAge.trim()),
    experienceRequired: draft.experienceRequired === "true",
  };

  // Boş bırakılan serbest alan gövdeye hiç girmez: boş dize kaydedilirse ilan
  // ekranında "Sektör: " gibi anlamsız bir satır doğar.
  if (draft.sector.trim()) body.sector = draft.sector.trim();
  if (draft.duties.trim()) body.duties = draft.duties.trim();
  if (draft.dressCode.trim()) body.dressCode = draft.dressCode.trim();
  if (draft.headcount.trim()) body.headcount = Number(draft.headcount.trim());

  return body;
}

/**
 * Fiyat önizlemesine (`POST /payment-quotes`) gönderilecek çalışan ücreti.
 *
 * Gövdeye giden `salary` ile **aynı** değeri üretiyor ve bu tesadüf değil:
 * `pricingService.snapshot(job)` kilidi `job.getSalary()` üzerinden kuruyor
 * (`JobManager.java:167`), yani önizlemede başka bir tutar sorulsaydı kullanıcı
 * yayımlarken gördüğünden farklı bir fiyata razı olmuş olurdu.
 */
export function quotedWorkerPayout(draft: JobDraft): string {
  return draft.salary.trim();
}

/** Taslakta seçili olan kategori; katalog okunamadıysa ya da eşleşme yoksa yok. */
function selectedCategory(
  categories: readonly JobCategory[] | null,
  draft: JobDraft,
): JobCategory | undefined {
  return categories?.find((candidate) => candidate.id === draft.categoryId);
}

/** Taslağın alanları; hem beyaz liste hem "bu ada karşılık bir input var" listesi. */
const draftFields = Object.keys(emptyJobDraft) as (keyof JobDraft)[];

/**
 * Sunucunun bildirdiği alan adının formdaki karşılığı.
 *
 * `@AssertTrue public boolean isAgeRangeOrdered()` için `error.getField()`
 * `ageRangeOrdered` üretiyor (`GlobalExceptionHandler.java:57-63`) ve bu ad
 * hiçbir input'a karşılık gelmiyor: eşleme kurulmazsa
 * `fieldError(state, "maxAge")` boş döner ve mesaj ekranda hiç görünmez.
 */
const fieldAliases: Readonly<Record<string, keyof JobDraft>> = {
  ageRangeOrdered: "maxAge",
};

/** Takma adları çözer; alanın kendi mesajı varsa ona dokunmaz. */
export function withJobFieldAliases(
  fieldErrors: Readonly<Record<string, string>>,
): Record<string, string> {
  const resolved: Record<string, string> = {};

  for (const [field, message] of Object.entries(fieldErrors)) {
    const target = fieldAliases[field] ?? field;
    // Alanın kendi mesajı daha özgül; takma addan gelen onu ezmez.
    if (target === field || fieldErrors[target] === undefined) resolved[target] = message;
  }

  return resolved;
}

/**
 * Adres alt gövdesinin hataları, kanonik adres bileşeninin beklediği adlarla.
 *
 * Backend iç içe DTO yolunu bildiriyor (`address.components.postalCode`);
 * bileşen ise düz bileşen adlarını okuyor ve yolu kırpmak çağırana ait.
 */
export function addressFieldErrors(
  fieldErrors: Readonly<Record<string, string>>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const [field, message] of Object.entries(fieldErrors)) {
    if (!field.startsWith("address.")) continue;
    errors[field.slice(field.lastIndexOf(".") + 1)] = message;
  }

  return errors;
}

/**
 * Ekranda bir alanı olmayan mesajlar.
 *
 * Bunlar üst banda çıkar: eşleşmeyen bir ad sessizce düşerse kullanıcı reddi
 * görür ama sebebini hiç göremez.
 */
export function unmatchedFieldMessages(
  fieldErrors: Readonly<Record<string, string>>,
): readonly string[] {
  return Object.entries(fieldErrors)
    .filter(([field]) => !isRenderedField(field))
    .map(([, message]) => message);
}

/**
 * Sihirbazın ulaşım adımının hata anahtarlarının öneki (is-koala/koala-web#187).
 *
 * Ulaşım planı ilanın gövdesine girmiyor — ayrı bir uca, ilan yaratıldıktan
 * sonra gidiyor — ve alan adları (`notes`, `shuttles[0].name`) ilan alanlarıyla
 * aynı düzlemde çakışmasın diye önek taşıyor. `TransportPlanFields` öneksiz
 * anahtar okuyor; kırpma `transportFieldErrorsOf` ile.
 */
export const transportFieldPrefix = "transport.";

export function transportFieldErrorsOf(
  fieldErrors: Readonly<Record<string, string>>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, message] of Object.entries(fieldErrors)) {
    if (field.startsWith(transportFieldPrefix)) errors[field.slice(transportFieldPrefix.length)] = message;
  }
  return errors;
}

export function withTransportFieldPrefix(
  fieldErrors: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, message]) => [`${transportFieldPrefix}${field}`, message]),
  );
}

function isRenderedField(field: string): boolean {
  if (field.startsWith("address.") || field.startsWith(transportFieldPrefix)) return true;
  const target = fieldAliases[field] ?? field;
  return (draftFields as string[]).includes(target);
}

/**
 * Taslağın tarayıcıda saklanan hâli.
 *
 * Uzun form kazayla kapandığında yazılanlar kaybolmamalı, ama **adres kanıtı
 * saklanmaz**: `candidateToken` tek kullanımlık ve 10 dakika yaşıyor
 * (`application.yaml:191-192`), yani süresi dolmuş bir kanıt kaydedilmiş forma
 * yapışırsa kullanıcı çözemeyeceği bir 400 görür. Taslak tipi adresi hiç
 * taşımıyor; okuma da beyaz listeyle yapılıyor, böylece elle kurcalanmış ya da
 * eski bir sürümden kalmış bir kayıt da kanıt sızdıramaz.
 */
export function serializeDraft(draft: JobDraft): string {
  return JSON.stringify(Object.fromEntries(draftFields.map((field) => [field, draft[field]])));
}

export function deserializeDraft(raw: string | null): JobDraft {
  if (!raw) return emptyJobDraft;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyJobDraft;
  }

  if (typeof parsed !== "object" || parsed === null) return emptyJobDraft;
  const stored = parsed as Record<string, unknown>;

  return Object.fromEntries(
    draftFields.map((field) => [
      field,
      typeof stored[field] === "string" ? stored[field] : emptyJobDraft[field],
    ]),
  ) as JobDraft;
}

/** `datetime-local` değeri; saat dilimi taşımaz çünkü karşılığı `LocalDateTime`. */
function timestampOf(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function ageOf(value: string): number | null {
  const trimmed = value.trim();
  if (!wholeNumberPattern.test(trimmed)) return null;
  const age = Number(trimmed);
  return age < 1 ? null : age;
}
