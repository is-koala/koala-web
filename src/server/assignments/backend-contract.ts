import "server-only";

import type {
  AssignmentStatus,
  PaymentStatus,
  WorkerAssignment,
} from "@/assignments/contract";

/** Backend'in çalışan ataması liste satırı. */
export type AssignmentDto = {
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
  assignmentDateTime?: string | null;
  actualCompletionDateTime?: string | null;
  workerPayout?: string | number | null;
  pricing?: {
    workerPayout?: string | number | null;
    currency?: string | null;
  } | null;
};

/** Backend'in sayfalı atama zarfı; liste ve sahiplik araması bunu paylaşır. */
export type AssignmentPageDto = {
  content: readonly AssignmentDto[];
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

/** Liste ve ayrıntı ekranlarının ortak, adres içermeyen atama özeti. */
export function projectWorkerAssignment(dto: AssignmentDto): WorkerAssignment {
  const payout = dto.pricing?.workerPayout ?? dto.workerPayout ?? "";

  return {
    id: dto.id,
    jobId: dto.job.id,
    title: dto.job.title,
    position: cleanText(dto.job.position),
    categoryName: cleanText(dto.job.category?.name),
    companyName: cleanText(dto.job.companyName),
    cityName: cleanText(dto.job.cityName),
    districtName: cleanText(dto.job.districtName),
    startsAt: dto.job.startDateTime,
    endsAt: dto.job.endDateTime,
    status: normalizeAssignmentStatus(dto.status),
    paymentStatus: normalizePaymentStatus(dto.paymentStatus),
    workerPayout: String(payout),
    currency: dto.pricing?.currency ?? "",
  };
}

function normalizeAssignmentStatus(value: string): AssignmentStatus {
  return assignmentStatuses.has(value as AssignmentStatus)
    ? (value as AssignmentStatus)
    : "UNKNOWN";
}

function normalizePaymentStatus(value: string): PaymentStatus {
  return paymentStatuses.has(value as PaymentStatus)
    ? (value as PaymentStatus)
    : "UNKNOWN";
}

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}
