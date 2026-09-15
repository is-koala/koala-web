import "server-only";

import type { ApplicationStatus } from "@/applications/contract";
import type {
  InboxQuery,
  ReceivedApplication,
  ReceivedApplicationPage,
} from "@/applications/inbox";
import { inboxPageSize } from "@/applications/inbox";
import { jobStatuses } from "@/jobs/lifecycle";
import { emptyBackendPage } from "@/lib/pagination";
import { clean, known, type PageDto } from "@/server/api/dto";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

/**
 * İşverenin gelen başvuruları.
 *
 * `GET /users/me/received-applications` — kapsamı backend kuruyor: bireysel
 * ilanda yaratıcı, şirket ilanında güncel yetkili. Kapsam dışı `jobId` /
 * `companyId` 404 değil boş sayfa; var olmayan kimlikle aynı yanıt
 * (koala-backend#233). Varsayılan sıra bekleyenleri öne alır; `sort`
 * göndermiyoruz ki o sıra yerini bırakmasın.
 */

type SafeUserDto = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  profilePictureUrl?: string | null;
};

type ReceivedApplicationDto = {
  id?: string | null;
  status?: string | null;
  applicationDateTime?: string | null;
  answeredDateTime?: string | null;
  notes?: string | null;
  applicant?: SafeUserDto | null;
  jobId?: string | null;
  postingTitle?: string | null;
  jobStatus?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  assignmentId?: string | null;
};

const statuses = new Set<ApplicationStatus>(["APPLIED", "ACCEPTED", "REJECTED", "WITHDRAWN"]);

export async function readReceivedApplications(query: InboxQuery): Promise<ReceivedApplicationPage> {
  const search = new URLSearchParams();
  if (query.status !== "ALL") search.set("status", query.status);
  if (query.jobId) search.set("jobId", query.jobId);
  if (query.companyId) search.set("companyId", query.companyId);
  search.set("page", String(query.page));
  search.set("size", String(inboxPageSize));

  const response = await apiRequest<PageDto<ReceivedApplicationDto> | null>(
    `${backendPaths.receivedApplications}?${search}`,
    { cache: "no-store" },
  );
  if (response === null) return emptyBackendPage(query.page, inboxPageSize);

  return {
    content: (response.content ?? []).map(toReceivedApplication),
    page: response.page ?? query.page,
    size: response.size ?? inboxPageSize,
    totalElements: response.totalElements ?? 0,
    totalPages: response.totalPages ?? 0,
    first: response.first ?? query.page === 0,
    last: response.last ?? true,
  };
}

function toReceivedApplication(dto: ReceivedApplicationDto): ReceivedApplication {
  const status = known(dto.status, statuses);
  return {
    id: dto.id ?? "",
    status: status === "UNKNOWN" ? "UNKNOWN" : status,
    appliedAt: dto.applicationDateTime ?? "",
    answeredAt: dto.answeredDateTime ?? null,
    notes: clean(dto.notes),
    applicant: {
      id: dto.applicant?.id ?? "",
      fullName: displayName(dto.applicant),
      profilePictureUrl: clean(dto.applicant?.profilePictureUrl),
    },
    jobId: dto.jobId ?? "",
    postingTitle: dto.postingTitle?.trim() || "İlan",
    jobStatus: known(dto.jobStatus, jobStatuses),
    companyId: dto.companyId ?? null,
    companyName: clean(dto.companyName),
    assignmentId: dto.assignmentId ?? null,
  };
}

/** Ad soyad boşsa kullanıcı adına düşer; ekranda hiç boş kart kalmaz. */
function displayName(user: SafeUserDto | null | undefined): string {
  const name = [user?.firstName, user?.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return name || user?.username?.trim() || "";
}
