import "server-only";

import type {
  CreateIndividualJobBody,
  JobCategory,
  PricingBreakdown,
} from "@/lib/job-posting";
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
  return apiRequest<JobDetail>(`${backendPaths.jobs}/${encodeURIComponent(jobId)}`);
}
