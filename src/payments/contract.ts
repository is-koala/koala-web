import type { AssignmentStatus, PaymentStatus } from "@/assignments/contract";
import type { PricingBreakdown } from "@/lib/job-posting";

export type EmployerType = "INDIVIDUAL" | "COMPANY" | "UNKNOWN";

export type EmployerAssignment = {
  readonly id: string;
  readonly jobId: string;
  readonly title: string;
  readonly position: string | null;
  readonly employerType: EmployerType;
  readonly workerName: string;
  readonly cityName: string | null;
  readonly districtName: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: AssignmentStatus;
  readonly paymentStatus: PaymentStatus;
  readonly pricing: PricingBreakdown | null;
};

export type EmployerAssignmentPage = {
  readonly content: readonly EmployerAssignment[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
  readonly first: boolean;
  readonly last: boolean;
};

export type PaymentAttempt = {
  readonly id: string;
  readonly status: PaymentAttemptStatus;
  readonly currency: string;
  readonly workerPayout: string;
  readonly serviceFeeRate: string;
  readonly serviceFeeAmount: string;
  readonly employerTotal: string;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly failureMessage: string | null;
};

export type PaymentAttemptStatus = "INITIATED" | "IN_REVIEW" | "SUCCEEDED" | "FAILED" | "UNKNOWN";

export type PaymentSession = {
  readonly paymentPageUrl: string;
  readonly pricing: PricingBreakdown;
};

export type PaymentResolution = "held" | "released" | "refunded" | "failed" | "pending";

export type PaymentReconciliation = {
  readonly assignment: EmployerAssignment | null;
  readonly attempts: readonly PaymentAttempt[];
  readonly resolution: PaymentResolution;
  readonly hasActiveDispute: boolean;
};

export type EmployerPaymentCompany = {
  readonly companyId: string;
  readonly hasAddress: boolean;
};
