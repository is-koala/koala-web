import "server-only";

import type { AssignmentStatus, PaymentStatus } from "@/assignments/contract";
import type { PricingBreakdown } from "@/lib/job-posting";
import type {
  EmployerAssignment,
  EmployerAssignmentPage,
  EmployerPaymentCompany,
  EmployerType,
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentReconciliation,
  PaymentSession,
} from "@/payments/contract";
import { paymentStatusPresentation } from "@/payments/checkout";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

type EmployerAssignmentDto = {
  id?: string | null;
  job?: {
    id?: string | null;
    title?: string | null;
    position?: string | null;
    employerType?: string | null;
    startDateTime?: string | null;
    endDateTime?: string | null;
    cityName?: string | null;
    districtName?: string | null;
  } | null;
  worker?: { firstName?: string | null; lastName?: string | null } | null;
  status?: string | null;
  paymentStatus?: string | null;
  pricing?: Partial<PricingBreakdown> | null;
};

type EmployerAssignmentPageDto = Omit<EmployerAssignmentPage, "content"> & {
  content: readonly EmployerAssignmentDto[];
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

const employerTypes = new Set<EmployerType>(["INDIVIDUAL", "COMPANY"]);
const paymentAttemptStatuses = new Set<PaymentAttemptStatus>([
  "INITIATED",
  "IN_REVIEW",
  "SUCCEEDED",
  "FAILED",
]);
const activeDisputeStatuses = new Set(["OPEN", "UNDER_REVIEW"]);

export async function readEmployerAssignments(
  pageNumber = 0,
  pageSize = 20,
): Promise<EmployerAssignmentPage> {
  const page = await apiRequest<EmployerAssignmentPageDto | null>(
    `${backendPaths.employerAssignments}&page=${pageNumber}&size=${pageSize}`,
    { cache: "no-store" },
  );
  if (page === null) return { ...emptyPage, page: pageNumber, size: pageSize };

  return { ...page, content: page.content.map(projectEmployerAssignment) };
}

type PaymentSessionDto = {
  paymentPageUrl?: string | null;
  pricing?: Partial<PricingBreakdown> | null;
  token?: string | null;
};

export async function createPaymentSession(assignmentId: string): Promise<PaymentSession> {
  const response = await apiRequest<PaymentSessionDto>(
    `${backendPaths.jobAssignments}/${encodeURIComponent(assignmentId)}/payment-session`,
    { method: "POST" },
  );
  const pricing = completePricing(response.pricing);
  if (!response.paymentPageUrl || pricing === null) {
    throw new Error("Payment session response is incomplete");
  }

  return { paymentPageUrl: response.paymentPageUrl, pricing };
}

type PaymentAttemptDto = {
  id?: string | null;
  status?: string | null;
  currency?: string | null;
  workerPayout?: string | number | null;
  commissionRate?: string | number | null;
  commissionAmount?: string | number | null;
  totalCharged?: string | number | null;
  pricing?: Partial<PricingBreakdown> | null;
  failureReason?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
};

export async function readPaymentAttempts(assignmentId: string): Promise<readonly PaymentAttempt[]> {
  const attempts = await apiRequest<readonly PaymentAttemptDto[] | null>(
    `${backendPaths.jobAssignments}/${encodeURIComponent(assignmentId)}/payments`,
    { cache: "no-store" },
  );
  return (attempts ?? []).map(projectPaymentAttempt);
}

export async function readEmployerPaymentCompany(jobId: string): Promise<EmployerPaymentCompany> {
  const job = await apiRequest<{
    company?: { id?: string | null; address?: unknown } | null;
  } | null>(`${backendPaths.jobs}/${encodeURIComponent(jobId)}`, { cache: "no-store" });
  return {
    companyId: job?.company?.id ?? "",
    hasAddress: job?.company?.address != null,
  };
}

export async function readAssignmentHasActiveDispute(assignmentId: string): Promise<boolean> {
  const disputes = await apiRequest<readonly { status?: string | null }[] | null>(
    `${backendPaths.jobAssignments}/${encodeURIComponent(assignmentId)}/disputes`,
    { cache: "no-store" },
  );
  return (disputes ?? []).some((dispute) =>
    dispute.status ? activeDisputeStatuses.has(dispute.status) : false);
}

export async function readEmployerAssignment(
  assignmentId: string,
): Promise<EmployerAssignment | null> {
  for (let pageNumber = 0; pageNumber < maximumAssignmentPages; pageNumber += 1) {
    const assignments = await readEmployerAssignments(pageNumber, 100);
    const found = assignments.content.find((assignment) => assignment.id === assignmentId);
    if (found) return found;
    if (assignments.last || pageNumber + 1 >= assignments.totalPages) return null;
  }
  return null;
}

export async function readAllEmployerAssignments(): Promise<readonly EmployerAssignment[]> {
  const first = await readEmployerAssignments(0, 100);
  const content = [...first.content];
  const pages = Math.min(first.totalPages, maximumAssignmentPages);
  for (let pageNumber = 1; pageNumber < pages; pageNumber += 1) {
    const page = await readEmployerAssignments(pageNumber, 100);
    content.push(...page.content);
    if (page.last) break;
  }
  return content;
}

/** Dönüş URL'sinin iddiasını değil, yetkili assignment/payment/dispute görünümlerini okur. */
export async function readPaymentReconciliation(
  assignmentId: string,
): Promise<PaymentReconciliation> {
  const assignment = await readEmployerAssignment(assignmentId);
  if (assignment === null) {
    return { assignment: null, attempts: [], resolution: "pending", hasActiveDispute: false };
  }
  const attempts = await readPaymentAttempts(assignment.id);
  return paymentReconciliation(assignment, attempts, false);
}

export async function readPaymentDetailsForAssignment(
  assignment: EmployerAssignment,
): Promise<PaymentReconciliation> {
  const [attempts, hasActiveDispute] = await Promise.all([
    readPaymentAttempts(assignment.id),
    readAssignmentHasActiveDispute(assignment.id),
  ]);

  return paymentReconciliation(assignment, attempts, hasActiveDispute);
}

function paymentReconciliation(
  assignment: EmployerAssignment,
  attempts: readonly PaymentAttempt[],
  hasActiveDispute: boolean,
): PaymentReconciliation {
  const resolution = paymentStatusPresentation(assignment.paymentStatus).resolution;

  return { assignment, attempts, resolution, hasActiveDispute };
}

function projectPaymentAttempt(dto: PaymentAttemptDto): PaymentAttempt {
  const pricing = completePricing(dto.pricing);
  return {
    id: dto.id ?? "",
    status: known(dto.status, paymentAttemptStatuses),
    currency: pricing?.currency ?? dto.currency ?? "",
    workerPayout: pricing?.workerPayout ?? decimal(dto.workerPayout),
    serviceFeeRate: pricing?.serviceFeeRate ?? decimal(dto.commissionRate),
    serviceFeeAmount: pricing?.serviceFeeAmount ?? decimal(dto.commissionAmount),
    employerTotal: pricing?.employerTotal ?? decimal(dto.totalCharged),
    completedAt: dto.completedAt ?? null,
    createdAt: dto.createdAt ?? "",
    failureMessage: clean(dto.failureReason) === null ? null : paymentAttemptFailureMessage,
  };
}

function projectEmployerAssignment(dto: EmployerAssignmentDto): EmployerAssignment {
  const workerName = [dto.worker?.firstName, dto.worker?.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");

  return {
    id: dto.id ?? "",
    jobId: dto.job?.id ?? "",
    title: dto.job?.title ?? "",
    position: clean(dto.job?.position),
    employerType: known(dto.job?.employerType, employerTypes),
    workerName,
    cityName: clean(dto.job?.cityName),
    districtName: clean(dto.job?.districtName),
    startsAt: dto.job?.startDateTime ?? "",
    endsAt: dto.job?.endDateTime ?? "",
    status: known(dto.status, assignmentStatuses),
    paymentStatus: known(dto.paymentStatus, paymentStatuses),
    pricing: completePricing(dto.pricing),
  };
}

function completePricing(value: Partial<PricingBreakdown> | null | undefined): PricingBreakdown | null {
  if (
    !value ||
    typeof value.pricingVersion !== "string" ||
    typeof value.currency !== "string" ||
    typeof value.workerPayout !== "string" ||
    typeof value.serviceFeeRate !== "string" ||
    typeof value.serviceFeeAmount !== "string" ||
    typeof value.employerTotal !== "string"
  ) return null;

  return value as PricingBreakdown;
}

function known<T extends string>(value: string | null | undefined, values: ReadonlySet<T>): T {
  return value && values.has(value as T) ? (value as T) : ("UNKNOWN" as T);
}

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function decimal(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

const emptyPage: EmployerAssignmentPage = {
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
  first: true,
  last: true,
};

/** Bozuk sayfalama zarfı sonsuz backend turuna dönüşmesin. */
const maximumAssignmentPages = 100;

const paymentAttemptFailureMessage =
  "Ödeme sağlayıcısı bu deneme için ek kontrol gerektirdi. Kartını ve banka doğrulamasını kontrol edebilirsin.";
