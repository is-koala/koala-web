import type { JobStatus } from "./lifecycle";
import type { SalaryType } from "./contract";

/**
 * İşverenin "İlanlarım" listesi.
 *
 * Liste `GET /users/me/jobs` ucundan geliyor ve o uç **creator bazlı**:
 * `JobManager.getJobsOfCurrentUser` (`:333`) `findAllByCreatorId` ile
 * sorguluyor. Yani bir şirketin ikinci yetkilisi, başka bir yetkilinin açtığı
 * şirket ilanını burada göremiyor. Ekran bu davranışı gizlemiyor, başlığında
 * yazıyor — sessizce eksik bir liste, kullanıcıya ilanının kaybolduğunu
 * düşündürürdü (is-koala/koala-web#33).
 *
 * `server-only` yok: hem sayfa hem istemci bileşeni aynı sıralama listesini
 * okuyor ve içinde ağ çağrısı ya da gizli değer yok.
 */

/** `JobEmployerType`; okunamayan bir değer rozet uydurmaz. */
export type JobEmployerType = "INDIVIDUAL" | "COMPANY" | "UNKNOWN";

/** `JobSummaryDto`'nun bu listede okunan parçası. */
export type EmployerJob = {
  readonly id: string;
  readonly title: string;
  readonly position: string | null;
  readonly companyName: string | null;
  readonly employerType: JobEmployerType;
  readonly status: JobStatus | "UNKNOWN";
  readonly salaryType: SalaryType;
  /**
   * Kilitlenen fiyattan çalışan ücreti; snapshot yoksa `null`.
   *
   * `JobSummaryDto.salary` alanından yeniden üretilmiyor: ADR-0002 fiyatı ilan
   * yayımlandığında donduruyor ve iki alan ayrışabilir. Ekranda kilitlenmiş
   * olanı göstermek gerekiyor.
   */
  readonly workerPayout: string | null;
  readonly currency: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly cityName: string | null;
  readonly districtName: string | null;
  readonly insuranceRequired: boolean;
  readonly applicationCount: number;
  readonly hiredCount: number;
  readonly headcount: number | null;
};

export type EmployerJobPage = {
  readonly content: readonly EmployerJob[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
  readonly first: boolean;
  readonly last: boolean;
};

/**
 * `JobManager.SORTABLE_FIELDS`.
 *
 * Liste burada yazılı çünkü sunucu tanımadığı alanı **sessizce yok saymıyor**,
 * 400 `PAGE_SORT_FIELD_NOT_ALLOWED` ile reddediyor
 * (`PageableSanitizer.rejectUnknownSort`). Beşinci bir alan sunmak, kullanıcıya
 * tıklandığında hata veren bir düğme vermek olurdu.
 */
/**
 * Sunucunun `JobManager.SORTABLE_FIELDS`'i. Üretim kodundan okunmuyor ve
 * okunmamalı — `jobSortOptions` zaten gerçek kapı. Burada durmasının sebebi
 * `employer-jobs.test.ts`: her arayüz seçeneğinin izin verilen bir alana
 * dayandığını ona karşı kanıtlıyor. Silinirse test de silinir ve sunucu
 * listesi değiştiğinde arayüz sessizce tıklandığında 400 veren bir düğme
 * sunmaya başlar.
 */
export const sortableJobFields: readonly string[] = [
  "createdAt",
  "salary",
  "startDateTime",
  "title",
];

/**
 * Sıralama seçenekleri, Spring'in `sort=alan,yön` biçiminde.
 *
 * Yön de burada sabit: her alanın kullanıcı için anlamlı olan tek bir yönü var
 * ve ayrı bir "artan/azalan" denetimi listeyi ikiye katlayıp hiçbir soruyu
 * cevaplamazdı.
 */
export const jobSortOptions = [
  { value: "createdAt,desc", label: "Önce en yeni" },
  { value: "startDateTime,asc", label: "Önce yaklaşan iş" },
  { value: "salary,desc", label: "Ücreti yüksek olan" },
  { value: "title,asc", label: "Başlığa göre (A-Z)" },
] as const;

export type JobSort = (typeof jobSortOptions)[number]["value"];

export const defaultJobSort: JobSort = "createdAt,desc";

/**
 * Adres çubuğundan gelen sıralama.
 *
 * Tanınmayan değer varsayılana düşüyor: elle yazılmış bir alan doğrudan `sort`
 * parametresine geçseydi liste kullanıcının düzeltemeyeceği bir 400'e düşerdi.
 * Dizi de tanınmıyor — tekrarlanan bir sorgu parametresi tek bir seçim değil.
 */
export function parseJobSort(value: string | string[] | undefined): JobSort {
  return typeof value === "string" && isJobSort(value) ? value : defaultJobSort;
}

function isJobSort(value: string): value is JobSort {
  return jobSortOptions.some((option) => option.value === value);
}
