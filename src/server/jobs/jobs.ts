import "server-only";

import type {
  CreateIndividualJobBody,
  JobCategory,
  PricingBreakdown,
} from "@/lib/job-posting";
import type {
  AddressPrecision,
  JobApplicationReceipt,
  JobDetail as PublicJobDetail,
  SalaryType,
} from "@/jobs/contract";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

/**
 * İlan uçlarının sunucu tarafı.
 *
 * Tarayıcı `api.iskoala.com` ile hiç konuşmuyor (ADR-0011); bu modül BFF'in
 * ilan yüzeyi ve yalnız `apiRequest` üzerinden gidiyor, yani süresi dolmuş
 * erişim tokenı sessizce yenileniyor.
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

export function fetchJobDetail(jobId: string): Promise<JobDetail> {
  return apiRequest<JobDetail>(jobPath(jobId));
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

/** Kimlik tarayıcıdan geliyor; yola konmadan kaçırılır. */
function jobPath(jobId: string): string {
  return `${backendPaths.jobs}/${encodeURIComponent(jobId)}`;
}

type JobDetailDto = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  duties?: string | null;
  dressCode?: string | null;
  category?: { name?: string | null } | null;
  company?: { name?: string | null } | null;
  creator?: { firstName?: string | null; lastName?: string | null } | null;
  salaryType?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  pricing?: { workerPayout?: string | null; currency?: string | null } | null;
  insuranceRequired?: boolean;
  experienceRequired?: boolean;
  address?: { displayAddress?: string | null } | null;
  addressPrecision?: string | null;
};

type JobApplicationDto = {
  id?: string | null;
};

const salaryTypes = new Set<SalaryType>(["HOURLY", "DAILY"]);
const addressPrecisions = new Set<AddressPrecision>(["APPROXIMATE", "EXACT"]);

export async function readJobDetail(jobId: string): Promise<PublicJobDetail | null> {
  // Yanıt oturum sahibine göre kesin veya yaklaşık adres taşıyabilir; kullanıcılar
  // arasında önbellek paylaşmak gizli adresi yanlış kişiye gösterebilirdi.
  const dto = await apiRequest<JobDetailDto | null>(`${backendPaths.jobs}/${jobId}`, {
    cache: "no-store",
  });
  return dto === null ? null : toJobDetail(dto);
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

function toJobDetail(dto: JobDetailDto): PublicJobDetail {
  const employerName = [dto.creator?.firstName, dto.creator?.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");

  return {
    id: dto.id ?? "",
    title: dto.title ?? "",
    description: clean(dto.description),
    duties: clean(dto.duties),
    dressCode: clean(dto.dressCode),
    categoryName: clean(dto.category?.name),
    companyName: clean(dto.company?.name),
    employerName: employerName || null,
    salaryType: known(dto.salaryType, salaryTypes),
    startsAt: dto.startDateTime ?? "",
    endsAt: dto.endDateTime ?? "",
    workerPayout: clean(dto.pricing?.workerPayout),
    currency: clean(dto.pricing?.currency),
    insuranceRequired: dto.insuranceRequired === true,
    experienceRequired: dto.experienceRequired === true,
    location: clean(dto.address?.displayAddress),
    addressPrecision: known(dto.addressPrecision, addressPrecisions),
  };
}

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function known<T extends string>(value: string | null | undefined, values: ReadonlySet<T>): T {
  return value !== null && value !== undefined && values.has(value as T)
    ? (value as T)
    : ("UNKNOWN" as T);
}
