import type { JobStatus } from "@/jobs/lifecycle";
import { employerApplicationsPath, jobApplicantsPath } from "@/lib/app-routes";
import { isUuid } from "@/lib/identifiers";
import type { BackendPage } from "@/lib/pagination";

import type { ApplicationFilter, ApplicationStatus } from "./contract";

/**
 * İşverenin ilanlar arası başvuru gelen kutusu.
 *
 * `server-only` yok, bilerek: adres süzgeci, inceleme bağlantısı ve liste
 * modeli hem sunucu sayfasında hem tarayıcıdaki süzgeç bağlantılarında
 * okunuyor. Ağ çağrısı ya da gizli değer yok.
 */

export type InboxQuery = {
  readonly status: ApplicationFilter;
  readonly jobId: string | null;
  readonly companyId: string | null;
  readonly page: number;
};

export type ReceivedApplication = {
  readonly id: string;
  readonly status: ApplicationStatus;
  readonly appliedAt: string;
  readonly answeredAt: string | null;
  readonly notes: string | null;
  readonly applicant: {
    readonly id: string;
    readonly fullName: string;
    readonly profilePictureUrl: string | null;
  };
  readonly jobId: string;
  readonly postingTitle: string;
  readonly jobStatus: JobStatus | "UNKNOWN";
  readonly companyId: string | null;
  readonly companyName: string | null;
  readonly assignmentId: string | null;
};

export type ReceivedApplicationPage = BackendPage<ReceivedApplication>;

export type InboxCompanyOption = {
  readonly companyId: string;
  readonly companyName: string;
};

export type InboxJobChoice = {
  readonly id: string;
  readonly title: string;
};

/** Backend `PageableDefault(size = 20)` ile aynı; ayrışırsa son sayfa sessizce kayardı. */
export const inboxPageSize = 20;

const statusFilters = new Set<ApplicationFilter>([
  "ALL",
  "APPLIED",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
]);

export const inboxStatusOptions: ReadonlyArray<{ value: ApplicationFilter; label: string }> = [
  { value: "ALL", label: "Tümü" },
  { value: "APPLIED", label: "Bekleyenler" },
  { value: "ACCEPTED", label: "Kabul edilenler" },
  { value: "REJECTED", label: "Reddedilenler" },
  { value: "WITHDRAWN", label: "Geri çekilenler" },
];

export function parseInboxQuery(
  search: Record<string, string | string[] | undefined>,
): InboxQuery {
  return {
    status: parseStatus(search.status),
    jobId: parseUuid(search.jobId),
    companyId: parseUuid(search.companyId),
    page: parsePage(search.page),
  };
}

export function inboxHref(query: InboxQuery): string {
  const search = new URLSearchParams();
  if (query.status !== "ALL") search.set("status", query.status);
  if (query.jobId) search.set("jobId", query.jobId);
  if (query.companyId) search.set("companyId", query.companyId);
  if (query.page > 0) search.set("page", String(query.page));
  const suffix = search.toString();
  return suffix ? `${employerApplicationsPath}?${suffix}` : employerApplicationsPath;
}

/**
 * Mevcut inceleme ekranı ilanın altında; gelen kutu satırı oradaki karta
 * çapalıyor (`applicant-${id}` başlık kimliği).
 */
export function inboxReviewHref({
  jobId,
  applicationId,
}: {
  jobId: string;
  applicationId: string;
}): string {
  return `${jobApplicantsPath(jobId)}#applicant-${applicationId}`;
}

export function inboxHasActiveFilters(query: InboxQuery): boolean {
  return query.status !== "ALL" || query.jobId !== null || query.companyId !== null;
}

/**
 * İlan süzgeci seçenekleri.
 *
 * Liste yalnız **bu sayfadaki** ilanları tanır; seçili kimlik sayfada yoksa
 * (süzgeç boş sonuç verdiğinde) onu "Seçili ilan" olarak tutmazsak kullanıcı
 * süzgeci göremez, kaldıramaz.
 */
export function inboxJobChoices(
  applications: ReadonlyArray<{ jobId: string; postingTitle: string }>,
  selectedJobId: string | null,
): readonly InboxJobChoice[] {
  const choices: InboxJobChoice[] = [];
  const seen = new Set<string>();
  for (const application of applications) {
    if (seen.has(application.jobId)) continue;
    seen.add(application.jobId);
    choices.push({ id: application.jobId, title: application.postingTitle || "İlan" });
  }
  if (selectedJobId && !seen.has(selectedJobId)) {
    choices.push({ id: selectedJobId, title: "Seçili ilan" });
  }
  return choices;
}

function parseStatus(value: string | string[] | undefined): ApplicationFilter {
  return typeof value === "string" && statusFilters.has(value as ApplicationFilter)
    ? (value as ApplicationFilter)
    : "ALL";
}

function parseUuid(value: string | string[] | undefined): string | null {
  return typeof value === "string" && isUuid(value) ? value : null;
}

function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 0;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 0;
}
