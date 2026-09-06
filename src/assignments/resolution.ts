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

export function canCancelAssignment(input: {
  assignmentStatus: string;
  resolution: Pick<WorkerAssignmentResolution, "cancellationPreview" | "disputes">;
}): boolean {
  return (input.assignmentStatus === "CONFIRMED" || input.assignmentStatus === "IN_PROGRESS") &&
    input.resolution.cancellationPreview?.cancellableNow === true &&
    !hasActiveDispute(input.resolution);
}
