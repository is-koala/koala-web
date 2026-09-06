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

export type ResolutionCommand =
  | { type: "cancel"; reason: string }
  | { type: "dispute"; reason: string };

export type ResolutionActionState =
  | { status: "idle" }
  | { status: "done"; message: string }
  | { status: "error"; errorCode: string; httpStatus: number };
