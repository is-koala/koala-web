import "server-only";

import type {
  ApplicationFilter,
  ApplicationStatus,
  WorkerApplication,
  WorkerApplicationPage,
} from "@/applications/contract";
import { apiRequest } from "@/server/session/session";

type MyApplicationDto = {
  id: string;
  job: {
    id: string;
    title: string;
    position?: string | null;
    companyName?: string | null;
    cityName?: string | null;
    districtName?: string | null;
    startDateTime: string;
    coverImageUrl?: string | null;
  };
  status: string;
  notes?: string | null;
  rejectionReason?: string | null;
  applicationDateTime: string;
  answeredDateTime?: string | null;
  assignmentId?: string | null;
};

type ApplicationPageDto = {
  content: readonly MyApplicationDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

const statuses = new Set<ApplicationStatus>(["APPLIED", "ACCEPTED", "REJECTED", "WITHDRAWN"]);

export async function readWorkerApplications({
  status,
  page,
}: {
  status: ApplicationFilter;
  page: number;
}): Promise<WorkerApplicationPage> {
  const search = new URLSearchParams();
  if (status !== "ALL") search.set("status", status);
  search.set("page", String(page));
  search.set("size", "20");
  const response = await apiRequest<ApplicationPageDto | null>(
    `/users/me/applications?${search}`,
  );
  if (response === null) return emptyPage(page);

  return {
    content: response.content.map(toWorkerApplication),
    page: response.page,
    size: response.size,
    totalElements: response.totalElements,
    totalPages: response.totalPages,
    first: response.first,
    last: response.last,
  };
}

export async function withdrawWorkerApplication(applicationId: string): Promise<void> {
  await apiRequest(`/job-applications/${applicationId}/withdraw`, { method: "POST" });
}

function toWorkerApplication(dto: MyApplicationDto): WorkerApplication {
  return {
    id: dto.id,
    jobId: dto.job.id,
    title: dto.job.title,
    position: dto.job.position ?? null,
    companyName: dto.job.companyName ?? null,
    cityName: dto.job.cityName ?? null,
    districtName: dto.job.districtName ?? null,
    startsAt: dto.job.startDateTime,
    coverImageUrl: dto.job.coverImageUrl ?? null,
    status: statuses.has(dto.status as ApplicationStatus)
      ? (dto.status as ApplicationStatus)
      : "UNKNOWN",
    notes: dto.notes ?? null,
    rejectionReason: dto.rejectionReason ?? null,
    appliedAt: dto.applicationDateTime,
    answeredAt: dto.answeredDateTime ?? null,
    assignmentId: dto.assignmentId ?? null,
  };
}

function emptyPage(page: number): WorkerApplicationPage {
  return {
    content: [],
    page,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    first: page === 0,
    last: true,
  };
}
