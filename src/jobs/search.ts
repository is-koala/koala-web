import { isUuid } from "@/lib/identifiers";
import { jobTypeValues, salaryTypeValues, type JobType } from "@/lib/job-posting";
import { formatMoney } from "@/lib/money";
import type { BackendPage } from "@/lib/pagination";

import { jobPageSize, type AddressPrecision, type SalaryType } from "./contract";
import { employerTypeValues, type JobEmployerType } from "./employer-jobs";
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
export type JobSearchPage = BackendPage<JobSummary>;

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
 *
 * Liste mobilin `JobSortOption` enum'uyla **birebir** aynı beş seçimi sunuyor
 * (`newest`, `startDateAsc`, `salaryDesc`, `salaryAsc`, `titleAsc`) — aynı ucu
 * çağıran iki istemcinin farklı sıralamalar sunması, aynı aramanın platforma
 * göre başka sıralanması demek olurdu. Dört alanın **sekiz** yönünü birden
 * açmak da bu yüzden yapılmadı: sunucu izin verse de mobilde karşılığı olmayan
 * üç seçim eklerdi.
 */
export const jobSortOptions = [
  { id: "en-yeni", label: "Önce en yeni", field: "createdAt,desc" },
  { id: "baslangic", label: "Önce yaklaşan iş", field: "startDateTime,asc" },
  { id: "ucret-azalan", label: "Ücreti yüksek olan", field: "salary,desc" },
  { id: "ucret-artan", label: "Ücreti düşük olan", field: "salary,asc" },
  { id: "baslik", label: "Başlığa göre (A-Z)", field: "title,asc" },
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
 * Süzgeç değeri olarak ücret ve işveren tipi.
 *
 * `contract.ts`'teki `SalaryType` ve `employer-jobs.ts`'teki `JobEmployerType`
 * `UNKNOWN` da taşıyor; o değer bir **yanıtın** okunamamış olması, bir seçim
 * değil. Süzgeç tipleri bu yüzden dar: `?ucret-tipi=UNKNOWN` sunucuda karşılığı
 * olmayan bir enum sabiti ve Spring'in bind aşamasında 400 üretirdi.
 */
export type JobSalaryTypeFilter = (typeof salaryTypeValues)[number];
export type JobEmployerTypeFilter = (typeof employerTypeValues)[number];

/** Ücret tipi süzgecinin kutu ve rozet metni; kartın birim ekiyle aynı sözcükler. */
export const salaryTypeFilterLabels: Readonly<Record<JobSalaryTypeFilter, string>> = {
  HOURLY: "Saatlik ücret",
  DAILY: "Günlük ücret",
};

/** İşveren tipi; kartın `employerLabel` metinleriyle aynı sözcükler. */
export const employerTypeFilterLabels: Readonly<Record<JobEmployerTypeFilter, string>> = {
  INDIVIDUAL: "Bireysel ilan",
  COMPANY: "Şirket ilanı",
};

/**
 * Üç durumlu süzgeçlerin adres çubuğundaki karşılığı.
 *
 * `sigorta` ve `deneyim` seçilmemiş, "evet" ve "hayır" olmak üzere **üç** hâl
 * taşıyor ve sunucu da öyle okuyor: `JobDao.searchIds` içinde
 * `(:insuranceRequired is null or j.insuranceRequired = :insuranceRequired)`,
 * yani `null` "süzme" demek ve `false` **sigortasız ilanları** süzüyor. İkisi
 * aynı şey değil, o yüzden alan bir onay kutusu değil: onay kutusu işaretsizken
 * gönderilmiyor ve "farketmez" ile "hayır"ı aynı hâle katlardı.
 *
 * İki değer bir **birlik**, düz dize değil. Etiket tabloları ve form kutusu bu
 * anahtarları ayrı ayrı elle yazıyordu: `evet` bir yerde `Evet` olduğunda
 * derleyicinin söyleyeceği bir şey yoktu ve kusuru yalnız bir test görebilirdi.
 * Birlik aynı iddiayı `tsc`'ye taşıyor — aynı commit'teki `salaryTypeFilterLabels`
 * zaten böyle anahtarlı.
 */
export const booleanFilterValues = ["evet", "hayir"] as const;

export type BooleanFilterValue = (typeof booleanFilterValues)[number];

/** Kanonik `boolean`'ı yeniden adres çubuğu değerine çevirir. */
function booleanFilterParam(value: boolean): BooleanFilterValue {
  return value ? "evet" : "hayir";
}

/**
 * Üç durumlu süzgecin form kutusundaki seçili değeri; `""` "farketmez".
 *
 * Boş dize seçildiğinde tarayıcı parametreyi boş gönderiyor,
 * `parseJobSearchParams` onu tanımıyor ve alan `null` kalıyor — yani
 * "farketmez" seçeneği süzgeci gerçekten kaldırıyor.
 */
export function booleanFilterChoice(value: boolean | null): BooleanFilterValue | "" {
  return value === null ? "" : booleanFilterParam(value);
}

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
  salaryType: "ucret-tipi",
  employerType: "isveren",
  minSalary: "min-ucret",
  maxSalary: "max-ucret",
  insuranceRequired: "sigorta",
  experienceRequired: "deneyim",
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
  readonly salaryType: JobSalaryTypeFilter | null;
  readonly employerType: JobEmployerTypeFilter | null;
  /**
   * Ücret aralığı; `Job.salary` ile karşılaştırılıyor, ekrandaki `pricing`
   * tutarıyla değil.
   *
   * `number` değil **dize**: sunucu tarafı `BigDecimal` ve `jobs.salary`
   * sütunu `NUMERIC(19,2)`. Değeri `Number`'a çevirmek, `money.ts`'in bütün
   * modülde kaçındığı şeyi tam da süzgecin sınırında yapardı — 19 haneli bir
   * ondalık kayan noktada yuvarlanır ve kullanıcının yazdığı sınır sunucuya
   * başka bir sayı olarak giderdi.
   */
  readonly minSalary: string | null;
  readonly maxSalary: string | null;
  /** Üç durumlu: `null` süzme, `true` gerekli, `false` gerekli **değil**. */
  readonly insuranceRequired: boolean | null;
  readonly experienceRequired: boolean | null;
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
    type: enumParam(raw[jobSearchParamNames.type], jobTypeValues),
    salaryType: enumParam(raw[jobSearchParamNames.salaryType], salaryTypeValues),
    employerType: enumParam(raw[jobSearchParamNames.employerType], employerTypeValues),
    minSalary: salaryParam(raw[jobSearchParamNames.minSalary]),
    maxSalary: salaryParam(raw[jobSearchParamNames.maxSalary]),
    insuranceRequired: booleanParam(raw[jobSearchParamNames.insuranceRequired]),
    experienceRequired: booleanParam(raw[jobSearchParamNames.experienceRequired]),
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
 * Adlar `JobSearchCriteriaDto`'dan birebir alınıyor ve mobil (`JobSearchQuery.
 * toQueryParameters`) aynı ucu aynı adlarla çağırıyor: `query`, `categoryId`,
 * `cityId`, `districtId`, `type`, `salaryType`, `employerType`, `minSalary`,
 * `maxSalary`, `insuranceRequired`, `experienceRequired`, `sort`. Uydurma alan
 * yok; iki istemci artık sunucunun aynı yüzeyini kullanıyor.
 *
 * Tek fark sınırlayıcı kutu (`minLatitude`…`maxLongitude`): mobilde harita
 * var, webde henüz yok (is-koala/koala-web#20 kapsam dışı bırakıyor). Bu bir
 * ayrışma değil, webde henüz olmayan bir ekran — alan sunucuda duruyor ve
 * harita geldiğinde aynı adlarla bağlanacak.
 *
 * Aralığın ters olması (`minSalary > maxSalary`) burada düzeltilmiyor.
 * Sunucu onu boş bir sonuçla yanıtlıyor ve boş sonuç ekranı süzgeci gevşetmeyi
 * zaten söylüyor; sınırları sessizce yer değiştirmek, kullanıcının sormadığı
 * bir soruyu cevaplayıp sonucu onun yazdığı aralıkmış gibi göstermek olurdu.
 */
export function backendJobSearchParams(query: JobSearchQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.text !== null) params.set("query", query.text);
  if (query.categoryId !== null) params.set("categoryId", query.categoryId);
  if (query.cityId !== null) params.set("cityId", query.cityId);
  if (query.districtId !== null) params.set("districtId", query.districtId);
  if (query.type !== null) params.set("type", query.type);
  if (query.salaryType !== null) params.set("salaryType", query.salaryType);
  if (query.employerType !== null) params.set("employerType", query.employerType);
  if (query.minSalary !== null) params.set("minSalary", query.minSalary);
  if (query.maxSalary !== null) params.set("maxSalary", query.maxSalary);
  if (query.insuranceRequired !== null) {
    params.set("insuranceRequired", String(query.insuranceRequired));
  }
  if (query.experienceRequired !== null) {
    params.set("experienceRequired", String(query.experienceRequired));
  }

  // Kullanıcıya 1 tabanlı sayı gösteriliyor, sunucu 0 tabanlı istiyor.
  params.set("page", String(query.page - 1));
  params.set("size", String(jobPageSize));
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
  if (query.salaryType !== null) params.set(jobSearchParamNames.salaryType, query.salaryType);
  if (query.employerType !== null) {
    params.set(jobSearchParamNames.employerType, query.employerType);
  }
  if (query.minSalary !== null) params.set(jobSearchParamNames.minSalary, query.minSalary);
  if (query.maxSalary !== null) params.set(jobSearchParamNames.maxSalary, query.maxSalary);
  if (query.insuranceRequired !== null) {
    params.set(jobSearchParamNames.insuranceRequired, booleanFilterParam(query.insuranceRequired));
  }
  if (query.experienceRequired !== null) {
    params.set(
      jobSearchParamNames.experienceRequired,
      booleanFilterParam(query.experienceRequired),
    );
  }
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
 *
 * **Altı yeni süzgeç neden buraya girdi, canonical'dan silinmedi.** Ayrım tek
 * bir soruya bakıyor: URL sonuç **kümesini** mi değiştiriyor, yoksa aynı
 * kümenin dizilişini mi? `sirala` ikincisi, o yüzden `canonicalPath` onu
 * silip beş adresi tek adreste topluyor. `ucret-tipi`, `isveren`,
 * `min-ucret`, `max-ucret`, `sigorta` ve `deneyim` birincisi — altısı da
 * `JobDao.searchIds` içinde ayrı bir `where` koşulu, yani sunucudan **başka
 * ilanlar** dönüyor. Onları da canonical'dan silmek, içeriği süzülmüş bir
 * sayfaya "asıl adresim süzgeçsiz liste" dedirtirdi: Google'ın gördüğü sayfa
 * ile işaret ettiği adres aynı ilanları taşımazdı. Bu yüzden süzgeçli URL
 * `noindex, follow` alıyor ve canonical **hiç** taşımıyor.
 */
export function hasJobFilters(query: JobSearchQuery): boolean {
  return (
    query.text !== null ||
    query.categoryId !== null ||
    query.cityId !== null ||
    query.districtId !== null ||
    query.type !== null ||
    query.salaryType !== null ||
    query.employerType !== null ||
    query.minSalary !== null ||
    query.maxSalary !== null ||
    query.insuranceRequired !== null ||
    query.experienceRequired !== null
  );
}

/** Rozet olarak çizilen, tek tek silinebilen bir süzgeç seçimi. */
export type ActiveJobFilter = {
  readonly id: string;
  readonly label: string;
  /** Yalnız bu seçim düşürülmüş sorgu; rozetin bağlantısı buradan üretiliyor. */
  readonly without: JobSearchQuery;
};

/**
 * Seçili süzgeçler, tek tek silinebilir hâlde.
 *
 * On bir süzgeç bir formda birikince kullanıcı hangilerinin açık olduğunu
 * kutulara tek tek bakarak çıkarmak zorunda kalıyor; hele biri ekranın altında
 * kalmışsa boş sonucun sebebi görünmez oluyor. Rozetler o durumu tek satırda
 * okunur yapıyor.
 *
 * Her rozet **sayfayı da sıfırlıyor**: bir süzgeç kalkınca sonuç kümesi
 * değişiyor ve kullanıcıyı eski kümenin yedinci sayfasında bırakmak, süzgeci
 * gevşetmenin karşılığı olarak boş bir ekran gösterirdi.
 *
 * İl rozeti ilçeyi de düşürüyor: ilçeler ilin kimliğiyle çekiliyor, yani il
 * kalkınca ilçe seçimi sahipsiz kalırdı.
 *
 * Sıralama listede **yok**: `hasJobFilters` onu bir süzgeç saymıyor ve bir
 * sıralama her zaman seçili — silinebilir bir rozet olarak çizmek, "kaldır"
 * düğmesi aslında "varsayılana dön" demek olurdu.
 */
export function activeJobFilters(
  query: JobSearchQuery,
  options: JobFilterOptions,
): readonly ActiveJobFilter[] {
  const filters: ActiveJobFilter[] = [];
  const drop = (patch: Partial<JobSearchQuery>): JobSearchQuery => ({
    ...query,
    ...patch,
    page: 1,
  });

  if (query.text !== null) {
    filters.push({ id: "ara", label: `“${query.text}” araması`, without: drop({ text: null }) });
  }
  if (query.categoryId !== null) {
    filters.push({
      id: "kategori",
      label: optionName(options.categories, query.categoryId, referenceFilterLabels.category),
      without: drop({ categoryId: null }),
    });
  }
  if (query.cityId !== null) {
    filters.push({
      id: "il",
      label: optionName(options.cities, query.cityId, referenceFilterLabels.city),
      without: drop({ cityId: null, districtId: null }),
    });
  }
  if (query.districtId !== null) {
    filters.push({
      id: "ilce",
      label: optionName(options.districts, query.districtId, referenceFilterLabels.district),
      without: drop({ districtId: null }),
    });
  }
  if (query.type !== null) {
    filters.push({ id: "tur", label: jobTypeLabels[query.type], without: drop({ type: null }) });
  }
  if (query.salaryType !== null) {
    filters.push({
      id: "ucret-tipi",
      label: salaryTypeFilterLabels[query.salaryType],
      without: drop({ salaryType: null }),
    });
  }
  if (query.employerType !== null) {
    filters.push({
      id: "isveren",
      label: employerTypeFilterLabels[query.employerType],
      without: drop({ employerType: null }),
    });
  }
  if (query.minSalary !== null) {
    filters.push({
      id: "min-ucret",
      label: `En az ${formatFilterSalary(query.minSalary)}`,
      without: drop({ minSalary: null }),
    });
  }
  if (query.maxSalary !== null) {
    filters.push({
      id: "max-ucret",
      label: `En çok ${formatFilterSalary(query.maxSalary)}`,
      without: drop({ maxSalary: null }),
    });
  }
  if (query.insuranceRequired !== null) {
    filters.push({
      id: "sigorta",
      label: insuranceFilterLabels[booleanFilterParam(query.insuranceRequired)],
      without: drop({ insuranceRequired: null }),
    });
  }
  if (query.experienceRequired !== null) {
    filters.push({
      id: "deneyim",
      label: experienceFilterLabels[booleanFilterParam(query.experienceRequired)],
      without: drop({ experienceRequired: null }),
    });
  }
  return filters;
}

/** Sigorta süzgecinin üç hâlinden ikisi; "farketmez" bir rozet çizmiyor. */
export const insuranceFilterLabels: Readonly<Record<BooleanFilterValue, string>> = {
  evet: "Sigortalı çalışma",
  hayir: "Sigortasız ilanlar",
};

export const experienceFilterLabels: Readonly<Record<BooleanFilterValue, string>> = {
  evet: "Deneyim isteniyor",
  hayir: "Deneyim istenmiyor",
};

/**
 * Sözlükte bulunmayan bir seçimin adı.
 *
 * Tek tablo, çünkü aynı metni iki taraf okuyor: rozet şeridi ve süzgeç
 * kutusunun kendisi. İki kopya olsaydı aynı seçim ekranın iki yerinde iki
 * farklı adla görünürdü.
 */
export const referenceFilterLabels = {
  category: "Seçili kategori",
  city: "Seçili il",
  district: "Seçili ilçe",
} as const;

/**
 * Sözlükten adı çözer; sözlük okunamamışsa genel bir etiket kalır.
 *
 * `readJobFilterOptions` başarısız olduğunda sayfa süzgeç kutularını boş
 * bırakıp listeyi çizmeye devam ediyor. Rozet o durumda kimliği ekrana
 * basmamalı ama **kaybolmamalı** da: adında ne yazdığı bilinmeyen bir süzgeç
 * hâlâ sonucu daraltıyor ve kullanıcının onu kaldırabilmesi gerekiyor.
 */
function optionName(options: readonly ReferenceOption[], id: string, fallback: string): string {
  return options.find((option) => option.id === id)?.name ?? fallback;
}

/**
 * Süzgeç kutusunun seçenekleri; sözlükte olmayan seçim de listeye giriyor.
 *
 * Bir görünüm tercihi değil, **veri kaybının** kapatılması. Sözlük ucu
 * okunamadığında kutu yalnız "Tüm iller"i taşıyordu, tarayıcı eşleşmeyen
 * `defaultValue`'yu o ilk seçeneğe düşürüyordu ve "İlanları süz"e basan
 * kullanıcı — boş sonuç ekranının tam da yapmasını söylediği şey — il, ilçe ve
 * kategori seçimini sessizce kaybediyordu. Rozet şeridi ise onları hâlâ seçili
 * gösteriyordu: aynı formun iki yarısı iki ayrı şey söylüyordu.
 *
 * Seçim listeye yazılınca üçü de aynı şeyi söylüyor — kutu, rozet ve gönderim.
 * Adı `optionName` ile aynı tablodan geliyor, yani kutuda okunan metin rozette
 * okunanla birebir aynı.
 */
export function referenceFieldOptions(
  options: readonly ReferenceOption[],
  selected: string | null,
  fallback: string,
): readonly ReferenceOption[] {
  if (selected === null || options.some((option) => option.id === selected)) return options;
  return [...options, { id: selected, name: fallback }];
}

/**
 * Rozetteki ücret sınırı.
 *
 * Kartla aynı biçimlendirici: süzgeç `Job.salary` ile karşılaştırılıyor ve o
 * alan `PricingManager` tarafından bugün yalnız `TRY` üretiliyor, yani rozet
 * kartta okunan tutarla aynı dilde konuşuyor. Ayrı bir biçimlendirme yazmak
 * aynı sayıyı iki farklı görünümde gösterirdi.
 */
function formatFilterSalary(amount: string): string {
  return formatMoney(amount, "TRY");
}

/**
 * İstenen sayfa listenin dışında mı.
 *
 * Boş bir **sayfa** ile boş bir **liste** ayrı iki hâl, ve `PageDto` ikisini
 * `totalElements` ile ayırıyor: altmış ilan varken `?sayfa=999` de 200 ve boş
 * `content` döndürür ama toplam sayı yerinde durur. Ayrım burada yapılıyor
 * çünkü iki karar birden buna bakıyor — gösterilecek metin ("henüz ilan yok"
 * demek ziyaretçiye sitenin boş olduğunu öğretirdi) ve sayfalama şeridinin
 * çizilip çizilmeyeceği ("Sayfa 999 / 3" bir konum değil, ve "Önceki sayfa"
 * 998'e gitse o da menzil dışı olurdu).
 */
export function isPageOutOfRange(page: JobSearchPage): boolean {
  return page.content.length === 0 && page.totalElements > 0;
}

/** Menzil dışı sayfadan dönülecek gerçek sayfa; sonuç varsa en az bir sayfa var. */
export function lastJobPage(page: JobSearchPage): number {
  return Math.max(page.totalPages, 1);
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

/** Beyaz listedeki enum sabiti; dışındaki her şey seçilmemiş sayılır. */
function enumParam<T extends string>(
  value: string | string[] | undefined,
  values: readonly T[],
): T | null {
  const raw = single(value);
  return values.find((option) => option === raw) ?? null;
}

function booleanParam(value: string | string[] | undefined): boolean | null {
  // Beyaz liste bir **dizi**, nesne değil. Anahtarları bir nesnede aramak
  // prototip zincirini de sayardı: `?sigorta=constructor` bir seçim gibi
  // okunur ve değer `undefined` olarak sunucuya çıkardı.
  const choice = enumParam(value, booleanFilterValues);
  return choice === null ? null : choice === "evet";
}

/**
 * Ücret sınırı; işaretsiz ondalık, en çok iki basamak.
 *
 * Kalıp `jobs.salary` sütununun kendisinden türüyor: `NUMERIC(19, 2)`, yani
 * ölçek 2 ve tam kısım en çok on yedi hane. Fazlası sunucuda karşılaştırılacak
 * bir tutar değil ve `BigDecimal`'e giden yolda gereksiz risk.
 *
 * Eksi değer de düşüyor. Sunucu onu kabul eder ve boş bir sonuç döndürürdü ama
 * `?min-ucret=-1` bir seçim değil, bozuk bir girdi: ekranda "En az -1 ₺" diye
 * bir rozet çizmek kullanıcıya yapmadığı bir tercihi geri okurdu.
 *
 * **Baştaki sıfır kırpılıyor, reddedilmiyor** — ve ayrım aynı ilkeden çıkıyor.
 * `?min-ucret=007` eksi değerin aksine gerçek bir sınır taşıyor: düşürmek
 * kullanıcının koyduğu süzgeci sessizce kaldırmak olurdu. Ama olduğu gibi
 * taşımak ilkenin öbür yüzüne çarpıyordu, çünkü rozet o dizeyi ekrana basıyor:
 * "En az 007,00 ₺", ve on yedi haneye kadar yazılabildiği için
 * "En çok 00.000.000.000.000.005,00 ₺". İkisi de kullanıcıya yapmadığı bir
 * tercihi geri okuyor. Kırpma `Number`'dan geçmiyor: `money.ts`'in bütün
 * modülde kaçındığı şey süzgecin sınırında da yapılmıyor.
 *
 * Kırpma kalıptan **önce** çalışıyor. Kalıbın ölçtüğü şey sütunun
 * taşıyabileceği büyüklük ve baştaki sıfır o büyüklüğü değiştirmiyor.
 *
 * Ondalık ayracı yalnız nokta. Türkçe yazımdaki virgül bilerek kabul
 * edilmiyor: `1,50` ile `1.500` aynı tuşlarla yazılıyor ve hangisinin
 * kastedildiğini uydurmak, kullanıcının koymadığı bir sınırı sunucuya
 * göndermek olurdu. Formdaki alan `type="number"`, yani tarayıcı zaten nokta
 * gönderiyor.
 */
const salaryPattern = /^\d{1,17}(?:\.\d{1,2})?$/;

function salaryParam(value: string | string[] | undefined): string | null {
  // Sıfırlar yalnız ardından bir **rakam** gelirken kırpılıyor: `0.05` tam
  // kısmındaki tek sıfırı korumalı, `.05` sunucuda `BigDecimal`'e bind edilmez.
  const raw = single(value)?.trim().replace(/^0+(?=\d)/, "");
  return raw !== undefined && salaryPattern.test(raw) ? raw : null;
}

function sortParam(value: string | string[] | undefined): JobSortId {
  const raw = single(value);
  return jobSortOptions.find((option) => option.id === raw)?.id ?? defaultJobSort;
}
