import "server-only";

import type {
  CreateCompanyJobBody,
  CreateIndividualJobBody,
  JobCategory,
  PricingBreakdown,
} from "@/lib/job-posting";
import { jobPageSize, type JobApplicationReceipt } from "@/jobs/contract";
import type { EmployerJob, EmployerJobPage, JobSort } from "@/jobs/employer-jobs";
import { jobStatuses } from "@/jobs/lifecycle";
import { isUuid } from "@/lib/identifiers";
import { emptyBackendPage } from "@/lib/pagination";
import {
  clean,
  employerTypes,
  known,
  openings,
  salaryTypes,
  type PageDto,
} from "@/server/api/dto";
import { companyPath } from "@/server/company/company";
import { backendPaths, jobPath } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

/**
 * İlan uçlarının **oturumlu** sunucu tarafı.
 *
 * Tarayıcı `api.iskoala.com` ile hiç konuşmuyor (ADR-0011); bu modül BFF'in
 * ilan yüzeyi ve yalnız `apiRequest` üzerinden gidiyor, yani süresi dolmuş
 * erişim tokenı sessizce yenileniyor.
 *
 * Herkese açık okumalar burada **değil**: onlar oturum taşımamak zorunda ve
 * `public-jobs.ts` içinde duruyorlar. Ayrım dosya sınırında, çünkü
 * `src/server/server-only.test.ts` ham `apiFetch` iznini dosya adına göre
 * veriyor — bu dosyanın bir gün oraya kayması, yenilemenin oturumlu uçlarda
 * sessizce devre dışı kalması demek olurdu.
 */

/** `IndividualJobDto`'nun bu akışta okunan parçası. */
export type CreatedIndividualJob = {
  id: string;
  pricing?: PricingBreakdown | null;
};

/** `JobTemplateDto`; şablon formu dolduruyor, tarih ve adres taşımıyor. */
export type JobTemplate = {
  id: string;
  templateName: string;
  category: JobCategory | null;
  title: string | null;
  description: string | null;
  sector: string | null;
  position: string | null;
  duties: string | null;
  dressCode: string | null;
  type: string | null;
  salaryType: string | null;
  salary: string | number | null;
  minAge: number | null;
  maxAge: number | null;
  experienceRequired: boolean | null;
};

/** `JobDetailDto`'nun yayım onayında okunan parçası. */
export type JobDetail = {
  id: string;
  title: string;
  status: string;
  salaryType: string;
  startDateTime: string;
  endDateTime: string;
  pricing: PricingBreakdown | null;
  /** İkisinin de okunma kuralı `openings` içinde (`@/server/api/dto`). */
  headcount: number | null;
  hiredCount: number;
  /**
   * Şirket ilanında `JobCompanyDto.id`; bireysel ilanda `null`.
   *
   * Galeri "şirket galerimden seç" yolunu buradan açıyor. Ad yoksa bölüm
   * çizilmez — isim yetmez, `GET /companies/{companyId}/images` kimlik ister.
   */
  companyId: string | null;
};

/** `GET /reference/job-categories`. Oturum istemiyor ama BFF yine tek kapıdan geçer. */
export function fetchJobCategories(): Promise<readonly JobCategory[]> {
  return apiRequest<readonly JobCategory[]>(backendPaths.jobCategories);
}

export function fetchJobTemplates(): Promise<readonly JobTemplate[]> {
  return apiRequest<readonly JobTemplate[]>(backendPaths.jobTemplates);
}

/**
 * `POST /payment-quotes`.
 *
 * Ücret ondalık dize olarak gidiyor: Jackson dizeyi doğrudan `BigDecimal`'e
 * çeviriyor ve kullanıcının yazdığı kuruş bir kayan nokta turundan geçmiyor
 * (koala-backend `CLAUDE.md` §2e).
 */
export function fetchPriceQuote(workerPayout: string): Promise<PricingBreakdown> {
  return apiRequest<PricingBreakdown>(backendPaths.paymentQuotes, {
    method: "POST",
    body: { workerPayout },
  });
}

export function createIndividualJob(
  body: CreateIndividualJobBody,
): Promise<CreatedIndividualJob> {
  return apiRequest<CreatedIndividualJob>(backendPaths.individualJobs, {
    method: "POST",
    body,
  });
}

/**
 * `POST /companies/{companyId}/jobs` — yanıt `CompanyJobDto`.
 *
 * Bireysel uçtan ayrı bir çağrı çünkü ayrı bir uç ve ayrı bir davranış:
 * `JobManager.createCorporateJob` sigorta zorunlu kategoriyi kabul ediyor,
 * `insuranceRequired` istiyor ve yetkililiği ilanın gövdesinden değil şirketin
 * yetkili listesinden okuyor. Yol `companyPath` ile kuruluyor ki şirket
 * kaynağının adresi tek yerde kalsın.
 */
export function createCompanyJob(
  companyId: string,
  body: CreateCompanyJobBody,
): Promise<CreatedIndividualJob> {
  return apiRequest<CreatedIndividualJob>(`${companyPath(companyId)}/jobs`, {
    method: "POST",
    body,
  });
}

/**
 * `GET /users/me/jobs` — açtığım ilanlar, sayfalı.
 *
 * Uç **creator bazlı** (`JobManager.java:333`): şirketin ikinci yetkilisi,
 * başka bir yetkilinin açtığı ilanı bu listede göremiyor. Modül bunu
 * düzeltemez — şirket bazlı bir liste ucu yok — ve gizlemeye de çalışmıyor;
 * ekran davranışı başlığında yazıyor.
 *
 * Sıralama çağırandan tipli geliyor: `PageableSanitizer.rejectUnknownSort`
 * tanımadığı alanı sessizce yok saymıyor, 400 döndürüyor.
 */
export async function readMyJobs({
  page,
  sort,
}: {
  page: number;
  sort: JobSort;
}): Promise<EmployerJobPage> {
  const search = new URLSearchParams({ page: String(page), size: String(jobPageSize), sort });
  const response = await apiRequest<PageDto<JobSummaryDto> | null>(
    `${backendPaths.individualJobs}?${search}`,
  );

  // `page` burada zaten sunucunun 0 tabanlı numarası; çağıran onu doğrudan
  // `Pageable`'a yazıyor.
  if (response === null) return emptyBackendPage<EmployerJob>(page, jobPageSize);

  return {
    content: (response.content ?? []).map(toEmployerJob),
    page: response.page ?? page,
    size: response.size ?? jobPageSize,
    totalElements: response.totalElements ?? 0,
    totalPages: response.totalPages ?? 0,
    first: response.first ?? page === 0,
    last: response.last ?? true,
  };
}

/** Yanıtta kontenjan alanları eksik gelebiliyor; ikisi de burada karara bağlanır. */
type JobDetailResponse = Omit<JobDetail, "headcount" | "hiredCount" | "companyId"> & {
  headcount?: number | null;
  hiredCount?: number | null;
  company?: { id?: string | null } | null;
};

export async function fetchJobDetail(jobId: string): Promise<JobDetail> {
  const dto = await apiRequest<JobDetailResponse>(jobPath(jobId));
  const companyId = dto.company?.id;
  return {
    ...dto,
    ...openings(dto),
    companyId: typeof companyId === "string" && isUuid(companyId) ? companyId : null,
  };
}

/**
 * `POST /jobs/{jobId}/close` — yeni başvuruyu durdurur.
 *
 * Yanıt `SuccessResult`, yani zarfın `data` alanı yok; çağıran bir değer
 * beklemesin diye dönüş `void`. Durum geçişinin kuralı burada tekrar
 * edilmiyor: `JobManager.closeJob` yalnız `OPEN` durumundan geçiyor ve
 * reddini 409 `JOB_NOT_OPEN` ile bildiriyor.
 */
export async function closeJob(jobId: string): Promise<void> {
  await apiRequest(`${jobPath(jobId)}/close`, { method: "POST" });
}

/**
 * `POST /jobs/{jobId}/cancel` — ilanı geçersiz kılar ve başvuranlara bildirim
 * gönderir.
 *
 * Kapatmadan ayrı bir uç, çünkü ayrı bir geçiş: devam eden bir atama varsa
 * backend 409 `JOB_HAS_LIVE_ASSIGNMENT` döndürüyor ve o koşul istemciden
 * görünmüyor (`JobDetailDto.hiredCount` başka bir durum kümesini sayıyor).
 */
export async function cancelJob(jobId: string): Promise<void> {
  await apiRequest(`${jobPath(jobId)}/cancel`, { method: "POST" });
}

type JobApplicationDto = {
  id?: string | null;
};

type JobSummaryDto = {
  id?: string | null;
  title?: string | null;
  position?: string | null;
  companyName?: string | null;
  employerType?: string | null;
  status?: string | null;
  salaryType?: string | null;
  pricing?: PricingBreakdown | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  cityName?: string | null;
  districtName?: string | null;
  insuranceRequired?: boolean;
  applicationCount?: number | null;
  hiredCount?: number | null;
  headcount?: number | null;
};

function toEmployerJob(dto: JobSummaryDto): EmployerJob {
  return {
    id: dto.id ?? "",
    title: dto.title ?? "",
    position: clean(dto.position),
    companyName: clean(dto.companyName),
    employerType: known(dto.employerType, employerTypes),
    status: known(dto.status, jobStatuses),
    salaryType: known(dto.salaryType, salaryTypes),
    // Snapshot'ı olmayan ilanda ücret `null` kalıyor: `salary` alanından
    // yeniden üretmek kilitlenmiş tutarla ayrışabilirdi (ADR-0002).
    workerPayout: clean(dto.pricing?.workerPayout),
    currency: clean(dto.pricing?.currency),
    startsAt: dto.startDateTime ?? "",
    endsAt: dto.endDateTime ?? "",
    cityName: clean(dto.cityName),
    districtName: clean(dto.districtName),
    insuranceRequired: dto.insuranceRequired === true,
    applicationCount: dto.applicationCount ?? 0,
    ...openings(dto),
  };
}

export async function createJobApplication(
  jobId: string,
  notes?: string,
): Promise<JobApplicationReceipt | null> {
  const body = notes === undefined ? {} : { notes };
  const dto = await apiRequest<JobApplicationDto | null>(
    `${backendPaths.jobs}/${jobId}/applications`,
    { method: "POST", body },
  );
  return dto === null ? null : { id: dto.id ?? "" };
}

