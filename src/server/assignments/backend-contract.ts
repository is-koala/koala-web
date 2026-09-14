import "server-only";

import type {
  AssignmentStatus,
  PaymentStatus,
  WorkerAssignment,
} from "@/assignments/contract";
import { clean, employerTypes, known } from "@/server/api/dto";

/** `SafeUserDto`; yalnız ekranda gösterilecek ad ve fotoğraf okunuyor. */
export type SafeUserDto = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
};

/**
 * Backend'in çalışan ataması liste satırı (`MyAssignmentDto`).
 *
 * `application`, `createdAt`, `confirmedAt`, `paymentSecuredAt`, `employer`,
 * `company`, `cancellation` ve `payout` is-koala/koala-backend#282 ile
 * geliyor ve henüz yayında değil; hepsi isteğe bağlı yazıldı. Alan yoksa
 * ekran o satırı **çizmez**, uydurmaz.
 */
export type AssignmentDto = {
  id: string;
  job: {
    id: string;
    title: string;
    position?: string | null;
    category?: { name?: string | null } | null;
    employerType?: string | null;
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
  messagingAvailable?: boolean | null;
  messagingAvailableReason?: string | null;
  createdAt?: string | null;
  confirmedAt?: string | null;
  paymentSecuredAt?: string | null;
  application?: {
    id?: string | null;
    applicationDateTime?: string | null;
    answeredDateTime?: string | null;
  } | null;
  employer?: SafeUserDto | null;
  company?: { id?: string | null; name?: string | null; logoUrl?: string | null } | null;
  cancellation?: { cancelledByParty?: string | null; cancelledAt?: string | null } | null;
  payout?: { id?: string | null; status?: string | null; completedAt?: string | null } | null;
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
    position: clean(dto.job.position),
    categoryName: clean(dto.job.category?.name),
    companyName: clean(dto.job.companyName),
    cityName: clean(dto.job.cityName),
    districtName: clean(dto.job.districtName),
    startsAt: dto.job.startDateTime,
    endsAt: dto.job.endDateTime,
    status: normalizeAssignmentStatus(dto.status),
    paymentStatus: normalizePaymentStatus(dto.paymentStatus),
    workerPayout: String(payout),
    currency: dto.pricing?.currency ?? "",
    employerType: known(dto.job.employerType, employerTypes),
    assignedAt: dto.assignmentDateTime ?? null,
  };
}

/** `SafeUserDto`'dan görünen ad; iki parça da boşsa `null`. */
export function personName(user: SafeUserDto | null | undefined): string | null {
  return clean([user?.firstName, user?.lastName].map((part) => clean(part)).filter(Boolean).join(" "));
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
