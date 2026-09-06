import "server-only";

import type { PayoutStatus, WorkerPayout } from "@/payments/payouts";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

type PayoutDto = {
  id: string;
  jobAssignmentId: string;
  amount: string | number;
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

/** Backend'in yeniden eskiye sıraladığı ödeme çıkışlarını aynı sırayla taşır. */
export async function readWorkerPayouts(): Promise<readonly WorkerPayout[]> {
  const payouts = await apiRequest<readonly PayoutDto[] | null>(backendPaths.currentUserPayouts, {
    cache: "no-store",
  });
  return (payouts ?? []).map(projectPayout);
}

function projectPayout(dto: PayoutDto): WorkerPayout {
  const reason = dto.failureReason?.trim();
  return {
    id: dto.id,
    assignmentId: dto.jobAssignmentId,
    amount: String(dto.amount),
    currency: dto.currency,
    status: payoutStatuses.has(dto.status as PayoutStatus)
      ? (dto.status as PayoutStatus)
      : "UNKNOWN",
    failureReason: reason || null,
    completedAt: dto.completedAt ?? null,
    createdAt: dto.createdAt,
  };
}
