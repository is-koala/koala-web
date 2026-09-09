import "server-only";

import { unstable_rethrow } from "next/navigation";

import type {
  AssignmentDispute,
  AssignmentResolution,
  CancellationPreview,
  CancellationRecord,
  DisputeEvidence,
  DisputeEvidenceState,
  DisputeResolution,
  DisputeStatus,
  DisputeEvidenceUploadResult,
  RefundStatus,
  WorkerAssignmentResolution,
} from "@/assignments/resolution";
import { backendPaths } from "@/server/contract";
import { ApiError } from "@/server/api/errors";
import { apiRequest } from "@/server/session/session";
import { safeDownloadFileName } from "@/lib/file-names";

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

type DisputeEvidenceDto = {
  id: string;
  disputeId: string;
  uploadedBy?: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  } | null;
  fileName?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  checksumSha256?: string | null;
  createdAt: string;
};

/**
 * İptal, iade ve uyuşmazlık yaşam döngüsünü tek bir dar atama görünümünde toplar.
 * Çağıran ekran backend uçlarını veya durum dönüştürme ayrıntılarını bilmez.
 */
export async function readAssignmentResolution(
  assignmentId: string,
  assignmentStatus: string,
): Promise<AssignmentResolution> {
  const [cancellationPreview, cancellation, disputeDtos] = await Promise.all([
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
    ),
  ]);

  const disputes = await Promise.all(disputeDtos.map(async (dto) => {
    return toAssignmentDispute(dto, await readDisputeEvidence(dto.id));
  }));

  return { cancellationPreview, cancellation, disputes };
}

async function readDisputeEvidence(disputeId: string): Promise<DisputeEvidenceState> {
  try {
    const evidence = await apiRequest<readonly DisputeEvidenceDto[]>(
      `/disputes/${encodeURIComponent(disputeId)}/evidence`,
      { cache: "no-store" },
    );
    return { status: "ready", items: evidence.map(toDisputeEvidence) };
  } catch (error) {
    unstable_rethrow(error);
    return error instanceof ApiError
      ? { status: "error", errorCode: error.errorCode, httpStatus: error.status }
      : { status: "error", errorCode: "UNEXPECTED", httpStatus: 502 };
  }
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
): Promise<AssignmentDispute> {
  const dispute = await apiRequest<AssignmentDisputeDto>(
    `${backendPaths.jobAssignments}/${assignmentId}/disputes`, {
    method: "POST",
    body: { reason },
  });
  return toAssignmentDispute(dispute);
}

export async function createAssignmentDisputeWithEvidence(
  assignmentId: string,
  reason: string,
  files: readonly File[],
): Promise<DisputeEvidenceUploadResult> {
  const dispute = await createAssignmentDispute(assignmentId, reason);
  try {
    return await uploadAssignmentDisputeEvidence(dispute.id, files);
  } catch (error) {
    unstable_rethrow(error);
    // Uyuşmazlık bu noktada kalıcı olarak açıldı. Kanıt isteğinin hatasını
    // komutun tamamı başarısızmış gibi taşımak ekranı bayat bırakır ve aynı
    // uyuşmazlığı yeniden açmaya teşvik eder; bunun yerine açılan kaydı ve
    // yüklenemeyen dosya sayısını çağırana açıkça bildir.
    return { disputeId: dispute.id, uploadedCount: 0, failedCount: files.length };
  }
}

export async function uploadAssignmentDisputeEvidence(
  disputeId: string,
  files: readonly File[],
): Promise<DisputeEvidenceUploadResult> {
  let uploadedCount = 0;
  let failedCount = 0;
  let firstFailure: unknown;

  for (const file of files) {
    const body = new FormData();
    body.set("file", file);
    try {
      await apiRequest(`/disputes/${encodeURIComponent(disputeId)}/evidence`, {
        method: "POST",
        body,
      });
      uploadedCount += 1;
    } catch (error) {
      unstable_rethrow(error);
      // Bir dosyanın reddi, diğer geçerli kanıtların uyuşmazlığa ulaşmasını
      // engellememeli. Action kullanıcıya tek tek dosya adı değil toplam sonucu verir.
      failedCount += 1;
      firstFailure ??= error;
    }
  }

  if (uploadedCount === 0 && failedCount > 0) throw firstFailure;
  return { disputeId, uploadedCount, failedCount };
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

function toAssignmentDispute(
  dto: AssignmentDisputeDto,
  evidence: DisputeEvidenceState = { status: "ready", items: [] },
): AssignmentDispute {
  return {
    id: dto.id,
    status: toDisputeStatus(dto.status),
    reason: dto.reason?.trim() || "Neden belirtilmedi",
    resolution: toDisputeResolution(dto.resolution),
    resolutionNote: dto.resolutionNote?.trim() || null,
    createdAt: dto.createdAt,
    resolvedAt: dto.resolvedAt ?? null,
    evidence,
  };
}

function toDisputeEvidence(dto: DisputeEvidenceDto): DisputeEvidence {
  const name = [dto.uploadedBy?.firstName, dto.uploadedBy?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return {
    id: dto.id,
    disputeId: dto.disputeId,
    uploadedByName: name || dto.uploadedBy?.username?.trim() || "Kullanıcı",
    fileName: safeDownloadFileName(dto.fileName?.trim() || "Kanıt dosyası"),
    contentType: dto.contentType?.trim() || "application/octet-stream",
    fileSize: typeof dto.fileSize === "number" && dto.fileSize >= 0 ? dto.fileSize : 0,
    createdAt: dto.createdAt,
  };
}

function canPreviewCancellation(status: string): boolean {
  return status === "CONFIRMED" || status === "IN_PROGRESS";
}

function toRefundStatus(value: string | null | undefined): RefundStatus | null {
  if (value == null) return null;
  return value === "PENDING" ||
    value === "PROCESSING" ||
    value === "COMPLETED" ||
    value === "FAILED"
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
