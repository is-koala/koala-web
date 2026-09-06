import "server-only";

import type {
  AssignmentDispute,
  AssignmentResolution,
  CancellationPreview,
  CancellationRecord,
  DisputeResolution,
  DisputeStatus,
  RefundStatus,
  WorkerAssignmentResolution,
} from "@/assignments/resolution";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

type CancellationPreviewDto = {
  feeRate: string;
  feeAmount: string;
  refundAmount: string;
  noticeMinutes: number;
  cancellableNow: boolean;
};

type CancellationDto = {
  id: string;
  cancelledByParty?: string | null;
  reason?: string | null;
  feeRate: string;
  feeAmount: string;
  refundAmount: string;
  noticeMinutes: number;
  cancelledAt: string;
  refundStatus?: string | null;
  refundCompletedAt?: string | null;
};

type AssignmentDisputeDto = {
  id: string;
  status?: string | null;
  reason?: string | null;
  resolution?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
};

/**
 * İptal, iade ve uyuşmazlık yaşam döngüsünü tek bir dar atama görünümünde toplar.
 * Çağıran ekran backend uçlarını veya durum dönüştürme ayrıntılarını bilmez.
 */
export async function readAssignmentResolution(
  assignmentId: string,
  assignmentStatus: string,
): Promise<AssignmentResolution> {
  const [cancellationPreview, cancellation, disputes] = await Promise.all([
    canPreviewCancellation(assignmentStatus)
      ? apiRequest<CancellationPreviewDto>(
          `${backendPaths.jobAssignments}/${assignmentId}/cancellation-preview`,
          { cache: "no-store" },
        ).then(toCancellationPreview)
      : Promise.resolve(null),
    assignmentStatus === "CANCELLED"
      ? apiRequest<CancellationDto>(
          `${backendPaths.jobAssignments}/${assignmentId}/cancellation`,
          { cache: "no-store" },
        ).then(toCancellationRecord)
      : Promise.resolve(null),
    apiRequest<readonly AssignmentDisputeDto[]>(
      `${backendPaths.jobAssignments}/${assignmentId}/disputes`,
      { cache: "no-store" },
    ).then((items) => items.map(toAssignmentDispute)),
  ]);

  return { cancellationPreview, cancellation, disputes };
}

/** İşçi istemcisinin bilmesi gerekmeyen işveren finansal alanlarını sunucuda keser. */
export async function readWorkerAssignmentResolution(
  assignmentId: string,
  assignmentStatus: string,
): Promise<WorkerAssignmentResolution> {
  const resolution = await readAssignmentResolution(assignmentId, assignmentStatus);
  return {
    cancellationPreview: resolution.cancellationPreview && {
      noticeMinutes: resolution.cancellationPreview.noticeMinutes,
      cancellableNow: resolution.cancellationPreview.cancellableNow,
    },
    cancellation: resolution.cancellation && {
      id: resolution.cancellation.id,
      cancelledByParty: resolution.cancellation.cancelledByParty,
      reason: resolution.cancellation.reason,
      noticeMinutes: resolution.cancellation.noticeMinutes,
      cancelledAt: resolution.cancellation.cancelledAt,
    },
    disputes: resolution.disputes,
  };
}

export async function cancelAssignment(assignmentId: string, reason: string): Promise<void> {
  await apiRequest(`${backendPaths.jobAssignments}/${assignmentId}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

export async function createAssignmentDispute(
  assignmentId: string,
  reason: string,
): Promise<void> {
  await apiRequest(`${backendPaths.jobAssignments}/${assignmentId}/disputes`, {
    method: "POST",
    body: { reason },
  });
}

function toCancellationPreview(dto: CancellationPreviewDto): CancellationPreview {
  return {
    feeRate: exactDecimal(dto.feeRate, "cancellationPreview.feeRate"),
    feeAmount: exactDecimal(dto.feeAmount, "cancellationPreview.feeAmount"),
    refundAmount: exactDecimal(dto.refundAmount, "cancellationPreview.refundAmount"),
    noticeMinutes: dto.noticeMinutes,
    cancellableNow: dto.cancellableNow,
  };
}

function toCancellationRecord(dto: CancellationDto): CancellationRecord {
  return {
    id: dto.id,
    cancelledByParty:
      dto.cancelledByParty === "EMPLOYER" || dto.cancelledByParty === "WORKER"
        ? dto.cancelledByParty
        : "UNKNOWN",
    reason: dto.reason?.trim() || "Neden belirtilmedi",
    feeRate: exactDecimal(dto.feeRate, "cancellation.feeRate"),
    feeAmount: exactDecimal(dto.feeAmount, "cancellation.feeAmount"),
    refundAmount: exactDecimal(dto.refundAmount, "cancellation.refundAmount"),
    noticeMinutes: dto.noticeMinutes,
    cancelledAt: dto.cancelledAt,
    refundStatus: toRefundStatus(dto.refundStatus),
    refundCompletedAt: dto.refundCompletedAt ?? null,
  };
}

function toAssignmentDispute(dto: AssignmentDisputeDto): AssignmentDispute {
  return {
    id: dto.id,
    status: toDisputeStatus(dto.status),
    reason: dto.reason?.trim() || "Neden belirtilmedi",
    resolution: toDisputeResolution(dto.resolution),
    resolutionNote: dto.resolutionNote?.trim() || null,
    createdAt: dto.createdAt,
    resolvedAt: dto.resolvedAt ?? null,
  };
}

function canPreviewCancellation(status: string): boolean {
  return status === "CONFIRMED" || status === "IN_PROGRESS";
}

function toRefundStatus(value: string | null | undefined): RefundStatus | null {
  if (value == null) return null;
  return value === "PENDING" || value === "COMPLETED" || value === "FAILED"
    ? value
    : "UNKNOWN";
}

function toDisputeStatus(value: string | null | undefined): DisputeStatus {
  return value === "OPEN" || value === "UNDER_REVIEW" || value === "RESOLVED"
    ? value
    : "UNKNOWN";
}

function toDisputeResolution(value: string | null | undefined): DisputeResolution {
  if (value == null) return null;
  return value === "RELEASE_TO_WORKER" ||
    value === "REFUND_EMPLOYER" ||
    value === "DISMISSED"
    ? value
    : null;
}

function exactDecimal(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be an exact decimal string`);
  }
  return value;
}
