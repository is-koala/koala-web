import "server-only";

import type { PayoutStatus, WorkerPayout } from "@/payments/payouts";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

type PayoutDto = {
  id: string;
  jobAssignmentId: string;
  amount: string;
  currency: string;
  status: string;
  failureReason?: string | null;
  completedAt?: string | null;
  createdAt: string;
};

const payoutStatuses = new Set<PayoutStatus>([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);

/** Aynı zaman damgalı kayıtları istemcide yeniden sıralayıp kararsızlaştırmamak için sunucu sırası korunur. */
export async function readWorkerPayouts(): Promise<readonly WorkerPayout[]> {
  const payouts = await apiRequest<readonly PayoutDto[] | null>(backendPaths.currentUserPayouts, {
    cache: "no-store",
  });
  return (payouts ?? []).map(projectPayout);
}

function projectPayout(dto: PayoutDto): WorkerPayout {
  const reason = dto.failureReason?.trim();
  const status = payoutStatuses.has(dto.status as PayoutStatus)
    ? (dto.status as PayoutStatus)
    : "UNKNOWN";
  return {
    id: dto.id,
    assignmentId: dto.jobAssignmentId,
    amount: exactDecimal(dto.amount),
    currency: dto.currency,
    status,
    failureMessage: reason ? safeFailureMessage(status) : null,
    completedAt: dto.completedAt ?? null,
    createdAt: dto.createdAt,
  };
}

function safeFailureMessage(status: PayoutStatus): string {
  return status === "FAILED"
    ? "Banka aktarımı tamamlanamadı. Ödeme hesabını kontrol edip destekten yardım alabilirsin."
    : "Banka aktarımının güncel durumu doğrulanıyor. Biraz sonra yeniden kontrol edebilirsin.";
}

function exactDecimal(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("payout.amount must be an exact decimal string");
  }
  return value;
}
