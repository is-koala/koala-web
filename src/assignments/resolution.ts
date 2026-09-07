export type RefundStatus = "PENDING" | "COMPLETED" | "FAILED" | "UNKNOWN";

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

export type ResolutionActionState =
  | { status: "idle" }
  | { status: "done"; message: string }
  | { status: "error"; errorCode: string; httpStatus: number };

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
