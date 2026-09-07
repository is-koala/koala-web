import { isUuid } from "@/lib/identifiers";
import { jobTypeValues, type JobType } from "@/lib/job-posting";

import type { AddressPrecision, SalaryType } from "./contract";
import type { JobEmployerType } from "./employer-jobs";
import type { JobStatus } from "./lifecycle";

/**
 * Herkese açık ilan aramasının paylaşılan sözleşmesi.
 *
 * `server-only` yok, bilerek: adres çubuğundaki süzgeci hem sunucuda çizilen
 * sayfa hem de o sayfanın altındaki form okuyor, ve modül ağ çağrısı ya da
 * gizli değer taşımıyor.
 *
 * Üç eşleme burada **tek yerde** duruyor — Türkçe sorgu parametreleri, sayfanın
 * kendi kanonik modeli, ve backend alan adları. Ayrı ayrı yazılsalardı bir
 * parametrenin adı değiştiğinde ikisi güncellenip üçüncüsü sessizce eski
 * kalırdı; okuyan taraf da yazan taraf da aynı tabloyu okumalı.
 */

/** `JobType`; okunamayan değer rozet uydurmaz. */
export type JobTypeValue = JobType | "UNKNOWN";

/**
 * `JobSummaryDto`'nun **tamamı**.
 *
 * Kartta bugün kullanılmayan alanlar da tipli: ilan detayı ve harita aynı
 * özet ucundan besleniyor, ve eksik bırakılan bir alan sonraki ekranın
 * `JobSummaryDto`'yu ikinci kez, farklı biçimde tiplemesine yol açardı.
 */
export type JobSummary = {
  readonly id: string;
  readonly title: string;
  readonly position: string | null;
  readonly sector: string | null;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly categoryCode: string | null;
  readonly employerType: JobEmployerType;
  readonly type: JobTypeValue;
  readonly salaryType: SalaryType;
  /**
   * `JobSummaryDto.salary` — `BigDecimal`. Ekranda gösterilen tutar bu değil:
   * ADR-0002 fiyatı ilan yayımlandığında donduruyor ve kart `pricing` anlık
   * görüntüsünü okuyor. Alan yine de taşınıyor, çünkü sunucunun `salary`
   * sıralaması buna göre çalışıyor.
   */
  readonly salary: string | null;
  /** `PricingBreakdownDto`; bütün tutarlar bilerek **dize**, yeniden yuvarlanmaz. */
  readonly workerPayout: string | null;
  readonly currency: string | null;
  readonly insuranceRequired: boolean;
  readonly experienceRequired: boolean;
  readonly startsAt: string;
  readonly endsAt: string;
  /** Sunucu yalnız `OPEN` ilan döndürüyor (`JobManager.java:315`); rozet çizilmiyor. */
  readonly status: JobStatus | "UNKNOWN";
  readonly cityName: string | null;
  readonly districtName: string | null;
  readonly companyName: string | null;
  readonly coverImageUrl: string | null;
  readonly applicationCount: number;
  readonly headcount: number | null;
  readonly hiredCount: number;
  /**
   * ADR-0003. `JobAddressVisibility.protect` anonim ziyaretçiye koordinatı iki
   * ondalığa yuvarlayarak veriyor ve `addressPrecision` bunu **söylüyor**.
   * Kesinlik `APPROXIMATE` iken bu iki alan bir adres değil bir bölge; liste
   * onları hiç çizmiyor, tip ise haritanın (sonraki issue) aynı bayrağı
   * okuması için taşıyor.
   */
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly addressPrecision: AddressPrecision;
};

/** Süzgeç kutularını dolduran sözlük maddesi; `CityDto`, `DistrictDto`, `JobCategoryDto`. */
export type ReferenceOption = {
  readonly id: string;
  readonly name: string;
};

/** Süzgeç formunun okuduğu sözlükler; hepsi `GET /reference/**`, kimlik istemez. */
export type JobFilterOptions = {
  readonly categories: readonly ReferenceOption[];
  readonly cities: readonly ReferenceOption[];
  /** Yalnız bir il seçiliyken dolu; il yokken sunulacak bir ilçe listesi yok. */
  readonly districts: readonly ReferenceOption[];
};

/** `PageDto<JobSummaryDto>`. */
export type JobSearchPage = {
  readonly content: readonly JobSummary[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
  readonly first: boolean;
  readonly last: boolean;
};

/**
 * Sabit sayfa boyutu.
 *
 * URL'den değiştirilemiyor ve bu bilinçli: `PageableSanitizer.java:15` tavanı
 * 100'de tutuyor, ama asıl mesele her sayfa boyutunun ayrı bir indekslenebilir
 * URL üretmesi. Yirmi hem sunucunun `@PageableDefault` değeri hem de mobilin
 * `JobService.defaultPageSize`'ı.
 */
export const jobSearchPageSize = 20;

/**
 * Sayfa numarası tavanı.
 *
 * Adres çubuğundan `?sayfa=99999999999999999999` gelebiliyor ve o değer
 * `Number` sınırını aşınca `page` alanına anlamsız bir şey yazılırdı. Tavan
 * kırpıyor; kırpılan sayfa da boş bir sonuç veriyor, hata değil.
 */
const maxJobSearchPage = 100_000;

/**
 * Sıralama seçenekleri.
 *
 * Anahtar Türkçe çünkü adres çubuğunda görünüyor; karşılığı
 * `JobManager.SORTABLE_FIELDS`'ten türüyor. Kullanıcı girdisi hiçbir zaman
 * `sort` alanına **geçmiyor**: `PageableSanitizer.rejectUnknownSort` tanımadığı
 * alanı sessizce yok saymıyor, 400 `PAGE_SORT_FIELD_NOT_ALLOWED` ile
 * reddediyor. Yani ham girdiyi taşımak, rastgele parametrelerle gelen bir
 * arama motoru botuna SSR sayfasını çökertmek olurdu.
 */
export const jobSortOptions = [
  { id: "en-yeni", label: "Önce en yeni", field: "createdAt,desc" },
  { id: "baslangic", label: "Önce yaklaşan iş", field: "startDateTime,asc" },
  { id: "ucret-azalan", label: "Ücreti yüksek olan", field: "salary,desc" },
  { id: "ucret-artan", label: "Ücreti düşük olan", field: "salary,asc" },
] as const;

export type JobSortId = (typeof jobSortOptions)[number]["id"];

export const defaultJobSort: JobSortId = "en-yeni";

/** İlan türünün Türkçe karşılığı; `job-form.tsx`'teki etiketlerle aynı. */
export const jobTypeLabels: Readonly<Record<JobType, string>> = {
  ONE_TIME: "Tek seferlik",
  RECURRING: "Tekrar eden",
};

/** Ücretin hangi birim üzerinden verildiği; `job-form.tsx` ile aynı metinler. */
export const salaryTypeLabels: Readonly<Record<SalaryType, string>> = {
  HOURLY: "saatlik",
  DAILY: "günlük",
  UNKNOWN: "",
};

/**
 * İlçe listesinin hangi ile ait olduğunu taşıyan gizli alan.
 *
 * Süzgeç formu JavaScript'siz çalışıyor: kullanıcı ili değiştirip gönderdiğinde
 * tarayıcı ekrandaki eski ilçe seçimini de yollar ve sunucu, artık başka bir
 * ilin ilçesiyle süzülmüş bir liste çizerdi. Form hangi ilin ilçelerini
 * gösterdiğini bu alanla söylüyor; uyuşmazsa ilçe düşer. Elle yazılmış bir
 * adreste alan hiç yok ve o zaman bir uyuşmazlık iddiası da yok.
 */
export const districtCityParamName = "ilce-ili";

/**
 * Adres çubuğundaki parametre adları.
 *
 * Türkçe çünkü paylaşılan ve indekslenen bir adresin parçası. Kalıcı kabul
 * edilir: değiştirmek paylaşılmış her bağlantının süzgecini düşürür.
 */
export const jobSearchParamNames = {
  page: "sayfa",
  text: "ara",
  categoryId: "kategori",
  cityId: "il",
  districtId: "ilce",
  type: "tur",
  sort: "sirala",
} as const;

/** Sayfanın kanonik arama modeli; adres çubuğu ile backend arasındaki tek biçim. */
export type JobSearchQuery = {
  /** 1 tabanlı, kullanıcıya görünen sayfa numarası. */
  readonly page: number;
  readonly text: string | null;
  readonly categoryId: string | null;
  readonly cityId: string | null;
  readonly districtId: string | null;
  readonly type: JobType | null;
  readonly sort: JobSortId;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Adres çubuğunu kanonik modele çevirir.
 *
 * Tanınmayan parametre okunmuyor bile: sunucuya yalnız burada adı geçen alanlar
 * gidiyor. Tanınan ama geçersiz olan değer de sunucuya taşınmıyor, çünkü
 * backend onları sessizce yok saymıyor — UUID olmayan bir `categoryId` ya da
 * enum'da olmayan bir `type` Spring'in bind aşamasında 400 üretir ve herkese
 * açık bir sayfa, ziyaretçinin düzeltemeyeceği bir hataya düşerdi.
 */
export function parseJobSearchParams(raw: RawSearchParams): JobSearchQuery {
  const cityId = uuidParam(raw[jobSearchParamNames.cityId]);

  return {
    page: parsePage(raw[jobSearchParamNames.page]),
    text: textParam(raw[jobSearchParamNames.text]),
    categoryId: uuidParam(raw[jobSearchParamNames.categoryId]),
    cityId,
    districtId: districtParam(raw, cityId),
    type: typeParam(raw[jobSearchParamNames.type]),
    sort: sortParam(raw[jobSearchParamNames.sort]),
  };
}

/**
 * İlçe seçimi.
 *
 * İki koşulda düşüyor. İl hiç seçilmemişse ilçe anlamsız: seçici ilçeleri ilin
 * kimliğiyle çekiyor, yani il kutusu boşken süzülmüş bir liste kullanıcının
 * kaldıramayacağı bir daraltma olurdu. İl **değişmişse** de düşüyor — formun
 * bildirdiği ilçe listesi artık başka bir ile ait.
 */
function districtParam(raw: RawSearchParams, cityId: string | null): string | null {
  if (cityId === null) return null;
  const districtCity = single(raw[districtCityParamName]);
  if (districtCity !== null && districtCity !== cityId) return null;
  return uuidParam(raw[jobSearchParamNames.districtId]);
}

/**
 * Backend'in `JobSearchCriteriaDto` ve `Pageable` alanları.
 *
 * Mobil aynı ucu aynı adlarla çağırıyor (`JobService.search`): `query`,
 * `categoryId`, `type`, `page`, `size`. Web ayrıca `cityId`, `districtId` ve
 * `sort` gönderiyor — üçü de sunucunun desteklediği ama mobilin henüz
 * kullanmadığı alanlar, uydurma değil.
 */
export function backendJobSearchParams(query: JobSearchQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.text !== null) params.set("query", query.text);
  if (query.categoryId !== null) params.set("categoryId", query.categoryId);
  if (query.cityId !== null) params.set("cityId", query.cityId);
  if (query.districtId !== null) params.set("districtId", query.districtId);
  if (query.type !== null) params.set("type", query.type);

  // Kullanıcıya 1 tabanlı sayı gösteriliyor, sunucu 0 tabanlı istiyor.
  params.set("page", String(query.page - 1));
  params.set("size", String(jobSearchPageSize));
  params.set("sort", sortField(query.sort));
  return params;
}

/** Kanonik modeli yeniden adres çubuğuna yazar; varsayılanlar URL'ye girmez. */
export function jobSearchParams(query: JobSearchQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.text !== null) params.set(jobSearchParamNames.text, query.text);
  if (query.categoryId !== null) params.set(jobSearchParamNames.categoryId, query.categoryId);
  if (query.cityId !== null) params.set(jobSearchParamNames.cityId, query.cityId);
  if (query.districtId !== null) params.set(jobSearchParamNames.districtId, query.districtId);
  if (query.type !== null) params.set(jobSearchParamNames.type, query.type);
  if (query.sort !== defaultJobSort) params.set(jobSearchParamNames.sort, query.sort);
  if (query.page > 1) params.set(jobSearchParamNames.page, String(query.page));
  return params;
}

/**
 * Süzgeç seçili mi.
 *
 * İki karar buna bakıyor: boş sonucun metni ("hiç ilan yok" ile "bu süzgece
 * uyan ilan yok" ayrı şeyler) ve indeksleme — süzgeç kombinasyonları sonsuz
 * sayıda URL demek ve hepsi indekslenirse Google yinelenen içerik görür.
 * Sıralama ve sayfa buraya dahil değil: ikisi de aynı sonuç kümesinin farklı
 * dilimleri, ayrı bir içerik değil.
 */
export function hasJobFilters(query: JobSearchQuery): boolean {
  return (
    query.text !== null ||
    query.categoryId !== null ||
    query.cityId !== null ||
    query.districtId !== null ||
    query.type !== null
  );
}

function sortField(sort: JobSortId): string {
  return jobSortOptions.find((option) => option.id === sort)!.field;
}

function single(value: string | string[] | undefined): string | null {
  // Tekrarlanan bir sorgu parametresi tek bir seçim değil; ilkini almak
  // kullanıcının hangisini kastettiğini uydurmak olurdu.
  return typeof value === "string" ? value : null;
}

function parsePage(value: string | string[] | undefined): number {
  const raw = single(value);
  if (raw === null || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  if (page < 1) return 1;
  return Math.min(page, maxJobSearchPage);
}

function textParam(value: string | string[] | undefined): string | null {
  return single(value)?.trim() || null;
}

function uuidParam(value: string | string[] | undefined): string | null {
  const raw = single(value);
  return raw !== null && isUuid(raw) ? raw : null;
}

function typeParam(value: string | string[] | undefined): JobType | null {
  const raw = single(value);
  return jobTypeValues.find((type) => type === raw) ?? null;
}

function sortParam(value: string | string[] | undefined): JobSortId {
  const raw = single(value);
  return jobSortOptions.find((option) => option.id === raw)?.id ?? defaultJobSort;
}
