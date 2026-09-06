import "server-only";

import type {
  AssignmentStatus,
  PaymentStatus,
  WorkerAssignment,
  WorkerAssignmentPage,
} from "@/assignments/contract";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

type MyAssignmentDto = {
  id: string;
  job: {
    id: string;
    title: string;
    position?: string | null;
    category?: { name?: string | null } | null;
    companyName?: string | null;
    cityName?: string | null;
    districtName?: string | null;
    startDateTime: string;
    endDateTime: string;
  };
  status: string;
  paymentStatus: string;
  workerPayout?: string | number | null;
  pricing?: { workerPayout?: string | null; currency?: string | null } | null;
};

type AssignmentPageDto = {
  content: readonly MyAssignmentDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

const assignmentStatuses = new Set<AssignmentStatus>([
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
]);

const paymentStatuses = new Set<PaymentStatus>([
  "PENDING_COLLECTION",
  "HELD_IN_ESCROW",
  "RELEASED_TO_WORKER",
  "FAILED",
  "REFUNDED",
]);

type AssignmentJobDetailDto = {
  addressPrecision?: string | null;
  address?: { displayAddress?: string | null } | null;
};

export async function readWorkerAssignments(
  pageNumber = 0,
  pageSize = 20,
): Promise<WorkerAssignmentPage> {
  const page = await apiRequest<AssignmentPageDto | null>(
    `${backendPaths.workerAssignments}&page=${pageNumber}&size=${pageSize}`,
  );
  if (page === null) return emptyPage;

  return {
    content: page.content.map(toWorkerAssignment),
    page: page.page,
    size: page.size,
    totalElements: page.totalElements,
    totalPages: page.totalPages,
    first: page.first,
    last: page.last,
  };
}

export async function readAssignmentAddress(jobId: string): Promise<string> {
  const job = await apiRequest<AssignmentJobDetailDto>(`/jobs/${jobId}`);
  const displayAddress = job.address?.displayAddress?.trim();
  if (job.addressPrecision !== "EXACT" || !displayAddress) {
    throw new Error("Assignment address is unavailable");
  }
  return displayAddress;
}

export async function respondToWorkerAssignment(
  assignmentId: string,
  accepted: boolean,
): Promise<void> {
  await apiRequest(`${backendPaths.jobAssignments}/${assignmentId}/respond`, {
    method: "POST",
    body: { accepted },
  });
}

function toWorkerAssignment(dto: MyAssignmentDto): WorkerAssignment {
  const payout = dto.pricing?.workerPayout ?? dto.workerPayout ?? "";

  return {
    id: dto.id,
    jobId: dto.job.id,
    title: dto.job.title,
    position: dto.job.position ?? null,
    categoryName: dto.job.category?.name ?? null,
    companyName: dto.job.companyName ?? null,
    cityName: dto.job.cityName ?? null,
    districtName: dto.job.districtName ?? null,
    startsAt: dto.job.startDateTime,
    endsAt: dto.job.endDateTime,
    status: assignmentStatus(dto.status),
    paymentStatus: paymentStatus(dto.paymentStatus),
    workerPayout: String(payout),
    currency: dto.pricing?.currency ?? "",
  };
}

function assignmentStatus(value: string): AssignmentStatus {
  return assignmentStatuses.has(value as AssignmentStatus)
    ? (value as AssignmentStatus)
    : "UNKNOWN";
}

function paymentStatus(value: string): PaymentStatus {
  return paymentStatuses.has(value as PaymentStatus) ? (value as PaymentStatus) : "UNKNOWN";
}

const emptyPage: WorkerAssignmentPage = {
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
};
