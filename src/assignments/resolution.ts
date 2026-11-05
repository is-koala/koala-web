import { imageUploadExtensions } from "@/lib/image-upload-policy";

export type RefundStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "UNKNOWN";

export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "UNKNOWN";

export type DisputeResolution =
  | "RELEASE_TO_WORKER"
  | "REFUND_EMPLOYER"
  | "DISMISSED"
  | null;

export type CancellationPreview = {
  feeRate: string;
  feeAmount: string;
  refundAmount: string;
  noticeMinutes: number;
  cancellableNow: boolean;
};

export type CancellationRecord = {
  id: string;
  cancelledByParty: "EMPLOYER" | "WORKER" | "UNKNOWN";
  reason: string;
  feeRate: string;
  feeAmount: string;
  refundAmount: string;
  noticeMinutes: number;
  cancelledAt: string;
  refundStatus: RefundStatus | null;
  refundCompletedAt: string | null;
};

export type AssignmentDispute = {
  id: string;
  status: DisputeStatus;
  reason: string;
  resolution: DisputeResolution;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  evidence: DisputeEvidenceState;
};

export type DisputeEvidenceState =
  | { status: "ready"; items: readonly DisputeEvidence[] }
  | { status: "error"; errorCode: string; httpStatus: number };

export type DisputeEvidence = {
  id: string;
  disputeId: string;
  uploadedByName: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
};

export type AssignmentResolution = {
  cancellationPreview: CancellationPreview | null;
  cancellation: CancellationRecord | null;
  disputes: readonly AssignmentDispute[];
};

/** İşçi tarayıcı modeline işverenin iade/kesinti tutarlarını taşımaz. */
export type WorkerAssignmentResolution = {
  cancellationPreview: Pick<CancellationPreview, "noticeMinutes" | "cancellableNow"> | null;
  cancellation: Pick<
    CancellationRecord,
    "id" | "cancelledByParty" | "reason" | "noticeMinutes" | "cancelledAt"
  > | null;
  disputes: readonly AssignmentDispute[];
};

export type ResolutionCommand =
  | { type: "cancel"; reason: string }
  | { type: "dispute"; reason: string };

export type DisputeEvidenceUploadResult = {
  disputeId: string;
  uploadedCount: number;
  failedCount: number;
};

export type ResolutionActionState =
  | { status: "idle" }
  | { status: "done"; message: string }
  | { status: "partial"; message: string }
  | { status: "error"; errorCode: string; httpStatus: number };

export const disputeEvidenceLimits = {
  maxFilesPerRequest: 1,
  maxFileBytes: 10 * 1024 * 1024,
  // Backend `evidenceExtensions` ile aynı: PDF + görsel politikası, WebP yok (koala-backend#348).
  acceptedExtensions: ["pdf", ...imageUploadExtensions],
} as const;

export type DisputeEvidenceUploadFeedback = {
  kind: "notice" | "warning";
  message: string;
};

export type DisputeEvidenceValidationErrorCode =
  | "DISPUTE_EVIDENCE_REQUIRED"
  | "DISPUTE_EVIDENCE_TOO_MANY"
  | "DISPUTE_EVIDENCE_EMPTY"
  | "DISPUTE_EVIDENCE_TOO_LARGE"
  | "STORAGE_UNSUPPORTED_TYPE"
  | "VALIDATION_FAILED";

export function disputeEvidenceFilesFromFormData(formData: FormData): readonly File[] | null {
  const files = disputeEvidenceEntries(formData);
  if (files === null) return null;
  return validateDisputeEvidenceFiles(files);
}

export function disputeEvidenceFormValidationError(
  formData: FormData,
  required = false,
): DisputeEvidenceValidationErrorCode | null {
  const files = disputeEvidenceEntries(formData);
  return files === null ? "VALIDATION_FAILED" : disputeEvidenceValidationError(files, required);
}

export function validateDisputeEvidenceFiles(
  value: unknown,
  required = false,
): readonly File[] | null {
  if (disputeEvidenceValidationError(value, required) !== null) return null;
  return value === undefined ? [] : value as readonly File[];
}

export function disputeEvidenceValidationError(
  value: unknown,
  required = false,
): DisputeEvidenceValidationErrorCode | null {
  if (value === undefined && !required) return null;
  if (!Array.isArray(value) || value.some((file) => !(file instanceof File))) {
    return "VALIDATION_FAILED";
  }
  if (value.length > disputeEvidenceLimits.maxFilesPerRequest) {
    return "DISPUTE_EVIDENCE_TOO_MANY";
  }
  if (required && value.length === 0) return "DISPUTE_EVIDENCE_REQUIRED";

  for (const file of value as File[]) {
    if (file.size === 0) return "DISPUTE_EVIDENCE_EMPTY";
    if (file.size > disputeEvidenceLimits.maxFileBytes) return "DISPUTE_EVIDENCE_TOO_LARGE";
    const dot = file.name.lastIndexOf(".");
    const extension = dot > 0 && dot < file.name.length - 1
      ? file.name.slice(dot + 1).toLowerCase()
      : "";
    if (!disputeEvidenceLimits.acceptedExtensions.some((accepted) => accepted === extension)) {
      return "STORAGE_UNSUPPORTED_TYPE";
    }
  }
  return null;
}

export function disputeEvidenceUploadFeedback(
  created: boolean,
  result: DisputeEvidenceUploadResult,
): DisputeEvidenceUploadFeedback {
  if (result.failedCount > 0) {
    return {
      kind: "warning",
      message: `${created ? "Uyuşmazlık açıldı. " : ""}${result.uploadedCount} kanıt yüklendi, ${result.failedCount} kanıt yüklenemedi.`,
    };
  }
  return { kind: "notice", message: `${result.uploadedCount} kanıt dosyası yüklendi.` };
}

function disputeEvidenceEntries(formData: FormData): readonly File[] | null {
  const entries = formData.getAll("evidence");
  if (entries.some((entry) => typeof entry === "string")) return null;
  return (entries as File[]).filter((file) => file.name !== "" || file.size > 0);
}

type DisputeGateState = {
  disputes: readonly Pick<AssignmentDispute, "status">[];
};

export function hasActiveDispute(resolution: DisputeGateState): boolean {
  return resolution.disputes.some((dispute) => isActiveDisputeStatus(dispute.status));
}

export function isActiveDisputeStatus(status: string | null | undefined): boolean {
  return status !== "RESOLVED";
}

export function canOpenAssignmentDispute(input: {
  assignmentStatus: string;
  paymentStatus: string;
  resolution: DisputeGateState;
}): boolean {
  return input.paymentStatus === "HELD_IN_ESCROW" &&
    ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(input.assignmentStatus) &&
    !hasActiveDispute(input.resolution);
}

/**
 * İptal önizleme bloğunun **çizilip çizilmediği** — iptalin açık olup olmadığı
 * ayrı bir soru ve onu `canCancelAssignment` cevaplıyor.
 *
 * `GET .../cancellation-preview` iptal edilemeyen atamada 409 değil
 * **200 + süre/tutar** döndürüyor (`CancellationManager.previewCancellation`,
 * `:138-140`): "şu anda iptal edemezsin" sunucunun hatası değil, cevabının bir
 * parçası. Blok `cancellableNow: false` diye kaybolursa kullanıcı ne başlangıca
 * kalan süreyi ne de nedeni okuyabiliyor, olmayan bir düğmeyi arıyor.
 *
 * Açık uyuşmazlık dışarıda tutuluyor: gerekçesi iki ekranda da bölümün
 * üstündeki kalıcı şeritte (`ActiveDisputeNotice`) yazılı ve blok içinde ikinci
 * kez tekrarlanmasına gerek yok.
 *
 * Kural ekranın içinde değil burada, çünkü işçi ve işveren bu soruyu aynı
 * kuralla cevaplıyor: önizleme yalnız `CONFIRMED`/`IN_PROGRESS` atamada
 * indiriliyor ve `cancellableNow` tarafa göre değişmiyor. Ayrılan tek şey
 * bloğun **içeriği** — işçi kesinti ve iade tutarlarını hiç görmüyor.
 */
export function showsCancellationPreview(
  resolution: Pick<WorkerAssignmentResolution, "cancellationPreview" | "disputes">,
): boolean {
  return resolution.cancellationPreview !== null && !hasActiveDispute(resolution);
}

export function canCancelAssignment(input: {
  assignmentStatus: string;
  resolution: Pick<WorkerAssignmentResolution, "cancellationPreview" | "disputes">;
}): boolean {
  return (input.assignmentStatus === "CONFIRMED" || input.assignmentStatus === "IN_PROGRESS") &&
    input.resolution.cancellationPreview?.cancellableNow === true &&
    !hasActiveDispute(input.resolution);
}
