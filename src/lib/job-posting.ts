/**
 * Bireysel ilanın istemci tarafındaki kuralları.
 *
 * Sunucuya kilitli değil: aynı kurallar hem tarayıcıdaki çok adımlı formda hem
 * de gönderimi karşılayan sunucu action'ında okunuyor. İkisi ayrı yazılsaydı
 * form kabul ettiği bir gövdeyi sunucuya reddettirebilirdi.
 *
 * Alan adları `CreateIndividualJobDto` ile birebir aynı: backend alan
 * hatalarını `details[].field` ile bildiriyor ve `fieldError(state, ad)` o adla
 * okunuyor; bir dönüştürme katmanı iki tarafı sessizce ayırırdı.
 */

import type { AddressWrite } from "@/address/contract";

/** `JobType`. */
export const jobTypeValues = ["ONE_TIME", "RECURRING"] as const;
export type JobType = (typeof jobTypeValues)[number];

/** `SalaryType`. Bireysel ilanda saatlik ve günlük dışında bir değer yok. */
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
 */
export type IndividualJobDraft = {
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
};

export const emptyIndividualJobDraft: IndividualJobDraft = {
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
 * Taslağın alan bazlı Türkçe hataları; anahtarlar DTO alan adlarıyla aynı.
 *
 * İstemci doğrulaması backend'i tekrarlamıyor, iki boşluğu kapatıyor:
 * kullanıcı eksiğini göndermeden önce görüyor, ve `endDateTime > startDateTime`
 * kuralının **tek** uygulayıcısı burası — `CreateIndividualJobDto` yalnız yaş
 * sırasını denetliyor, tarih sırasını hiç denetlemiyor.
 */
export function individualJobErrors(
  draft: IndividualJobDraft,
  categories: readonly JobCategory[] | null,
): Record<string, string> {
  const errors: Record<string, string> = {};

  // Katalog `null` ise "okunamadı" demek, "boş" demek değil: sigorta kuralı
  // denetlenemez ve son söz backend'e kalır (`JobManager.java:134-137` onu
  // gerçekten uyguluyor). Boş liste ile karıştırılsaydı katalog düştüğünde
  // hiçbir kategori seçilemez görünürdü.
  const category = categories?.find((candidate) => candidate.id === draft.categoryId);
  if (categories !== null && !category) {
    errors.categoryId = "Bir iş kategorisi seçmelisin.";
  } else if (!draft.categoryId.trim()) {
    errors.categoryId = "Bir iş kategorisi seçmelisin.";
  } else if (category?.requiresInsurance) {
    // `JobManager.java:134-137` bu isteği koşulsuz reddediyor; kullanıcıyı
    // formu doldurduktan sonra öğrenmeye bırakmak akışı çökertirdi.
    errors.categoryId = "Bu kategori sigorta zorunluluğu taşıyor, bireysel ilanla açılamaz.";
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
 * `POST /users/me/jobs` gövdesi — `CreateIndividualJobDto`.
 *
 * `insuranceRequired` ve `addressPublic` **yok**, bilerek: DTO ikisini de
 * taşımıyor ve sunucu ikisini de sabitliyor (`JobManager.java:153,155`).
 * Forma sigorta anahtarı ya da "adresi ilanda göster" seçeneği konmasın diye
 * gövde tipi de onları kabul etmiyor.
 */
export type CreateIndividualJobBody = {
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
 * Taslağı gövdeye çevirir; kurallardan biri bile ihlal edilmişse `null`.
 *
 * Adres **dışarıdan** geliyor ve olduğu gibi taşınıyor: kanonik adres bileşeni
 * (is-koala/koala-web#27) `AddressWriteV2` gövdesini hazır veriyor ve
 * `AddressWriteDto.java:43-46` bilinmeyen her alanı `REQUEST_MALFORMED`'a
 * çeviriyor — üzerine tek bir alan eklemek bütün gönderimi çöpe atardı.
 */
export function individualJobBody(
  draft: IndividualJobDraft,
  address: AddressWrite | null,
  categories: readonly JobCategory[] | null,
): CreateIndividualJobBody | null {
  if (address === null) return null;
  if (Object.keys(individualJobErrors(draft, categories)).length > 0) return null;

  const body: CreateIndividualJobBody = {
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
export function quotedWorkerPayout(draft: IndividualJobDraft): string {
  return draft.salary.trim();
}

/** Taslağın alanları; hem beyaz liste hem "bu ada karşılık bir input var" listesi. */
const draftFields = Object.keys(emptyIndividualJobDraft) as (keyof IndividualJobDraft)[];

/**
 * Sunucunun bildirdiği alan adının formdaki karşılığı.
 *
 * `@AssertTrue public boolean isAgeRangeOrdered()` için `error.getField()`
 * `ageRangeOrdered` üretiyor (`GlobalExceptionHandler.java:57-63`) ve bu ad
 * hiçbir input'a karşılık gelmiyor: eşleme kurulmazsa
 * `fieldError(state, "maxAge")` boş döner ve mesaj ekranda hiç görünmez.
 */
const fieldAliases: Readonly<Record<string, keyof IndividualJobDraft>> = {
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

function isRenderedField(field: string): boolean {
  if (field.startsWith("address.")) return true;
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
export function serializeDraft(draft: IndividualJobDraft): string {
  return JSON.stringify(Object.fromEntries(draftFields.map((field) => [field, draft[field]])));
}

export function deserializeDraft(raw: string | null): IndividualJobDraft {
  if (!raw) return emptyIndividualJobDraft;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyIndividualJobDraft;
  }

  if (typeof parsed !== "object" || parsed === null) return emptyIndividualJobDraft;
  const stored = parsed as Record<string, unknown>;

  return Object.fromEntries(
    draftFields.map((field) => [
      field,
      typeof stored[field] === "string" ? stored[field] : emptyIndividualJobDraft[field],
    ]),
  ) as IndividualJobDraft;
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
