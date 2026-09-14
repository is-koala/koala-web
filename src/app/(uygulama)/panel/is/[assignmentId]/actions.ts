"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import type {
  WorkDetail,
  WorkDetailActionResult,
  WorkDetailCommand,
} from "@/assignments/work-detail";
import {
  disputeEvidenceUploadFeedback,
  disputeEvidenceValidationError,
  validateDisputeEvidenceFiles,
  type DisputeEvidenceUploadResult,
} from "@/assignments/resolution";
import { reviewCommentMaxLength } from "@/assignments/review";
import { isUuid } from "@/lib/identifiers";
import type { ConversationState } from "@/messaging/contract";
import {
  cancelAssignment,
  checkpoint,
  createAssignmentDispute,
  createAssignmentDisputeWithEvidence,
  createAssignmentReview,
  readWorkDetail,
  uploadAssignmentDisputeEvidence,
} from "@/server/assignments/work-detail";
import { failureView } from "@/server/form";
import { openWorkerConversation } from "@/server/messaging/messaging";
import { requireSessionForCurrentPath } from "@/server/session/guard";

export async function workDetailAction(
  assignmentId: string,
  command: WorkDetailCommand,
): Promise<WorkDetailActionResult> {
  await requireSessionForCurrentPath();
  const validated = validateCommand(command);
  if (!isUuid(assignmentId)) return validationFailure;
  if (!validated) {
    const evidenceError = commandEvidenceValidationError(command);
    return evidenceError === null
      ? validationFailure
      : { status: "error", errorCode: evidenceError, httpStatus: 400 };
  }

  try {
    const upload = await execute(assignmentId, validated);
    const detail = await readWorkDetail(assignmentId);
    if (!detail) return assignmentNotFound;
    return upload
      ? { status: "done", detail, feedback: disputeEvidenceUploadFeedback(validated.type === "dispute", upload) }
      : { status: "done", detail };
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureView(error);
    const detail =
      failure.httpStatus === 404 || failure.httpStatus === 409
        ? await reloadAfterConflict(assignmentId)
        : null;
    return {
      status: "error",
      errorCode: failure.errorCode,
      httpStatus: failure.httpStatus,
      ...(detail ? { detail } : {}),
    };
  }
}

/**
 * İş ayrıntısından işverenle konuşma açma.
 *
 * `workDetailAction`'ın komut kanalına girmiyor: o kanal ekranı yerinde
 * tazeliyor, bu eylem ise başarıda mesaj kabuğuna **yönlendiriyor** ve
 * `redirect` bir `startTransition` içinden değil form eyleminden atılmalı.
 * İlan kimliği sunucuda okunan atamadan bağlanıyor. Kapı
 * (`messagingAvailable`) düğmeyi önden kapatıyor; buradaki 403/409 kararın
 * bayatladığı hâl ve metni `errorCode` ile kataloğdan seçiliyor.
 */
export async function workConversationAction(
  jobId: string,
  _state: ConversationState,
  formData: FormData,
): Promise<ConversationState> {
  void _state;
  void formData;
  await requireSessionForCurrentPath();

  if (!isUuid(jobId)) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  let conversationId: string;
  try {
    conversationId = await openWorkerConversation(jobId);
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", ...failureView(error) };
  }

  // `redirect()` istisna atarak çalışıyor; `try` dışında kalmalı.
  redirect(`/panel/mesajlar/${encodeURIComponent(conversationId)}`);
}

async function execute(
  assignmentId: string,
  command: WorkDetailCommand,
): Promise<DisputeEvidenceUploadResult | null> {
  switch (command.type) {
    case "refresh":
      return null;
    case "checkpoint":
      await checkpoint(assignmentId, command.kind, command.point);
      return null;
    case "cancel":
      await cancelAssignment(assignmentId, command.reason);
      return null;
    case "dispute": {
      if (command.evidence && command.evidence.length > 0) {
        return createAssignmentDisputeWithEvidence(
          assignmentId,
          command.reason,
          command.evidence,
        );
      }
      await createAssignmentDispute(assignmentId, command.reason);
      return null;
    }
    case "evidence":
      return uploadAssignmentDisputeEvidence(command.disputeId, command.evidence);
    case "review":
      await createAssignmentReview(
        assignmentId,
        command.rating,
        command.comment,
      );
      return null;
  }
}

async function reloadAfterConflict(assignmentId: string): Promise<WorkDetail | null> {
  try {
    return await readWorkDetail(assignmentId);
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

function validateCommand(value: unknown): WorkDetailCommand | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (value.type === "refresh") return { type: "refresh" };

  if (value.type === "checkpoint") {
    if (value.kind !== "check-in" && value.kind !== "check-out") return null;
    if (value.point === null) {
      return { type: "checkpoint", kind: value.kind, point: null };
    }
    if (!isRecord(value.point)) return null;
    const { latitude, longitude } = value.point;
    if (
      typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      typeof longitude !== "number" ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) return null;
    return { type: "checkpoint", kind: value.kind, point: { latitude, longitude } };
  }

  if (value.type === "cancel" || value.type === "dispute") {
    if (typeof value.reason !== "string") return null;
    const reason = value.reason.trim();
    const maxLength = value.type === "cancel" ? 1000 : 2000;
    if (!reason || reason.length > maxLength) return null;
    if (value.type === "cancel") return { type: "cancel", reason };
    const evidence = validateDisputeEvidenceFiles(value.evidence);
    return evidence === null ? null : { type: "dispute", reason, evidence };
  }

  if (value.type === "evidence") {
    if (typeof value.disputeId !== "string" || !isUuid(value.disputeId)) return null;
    const evidence = validateDisputeEvidenceFiles(value.evidence, true);
    return evidence === null ? null : { type: "evidence", disputeId: value.disputeId, evidence };
  }

  if (value.type === "review") {
    if (
      typeof value.rating !== "number" ||
      !Number.isInteger(value.rating) ||
      value.rating < 1 ||
      value.rating > 5 ||
      typeof value.comment !== "string" ||
      value.comment.length > reviewCommentMaxLength
    ) return null;
    return { type: "review", rating: value.rating, comment: value.comment.trim() };
  }

  return null;
}

function commandEvidenceValidationError(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (value.type === "dispute") {
    if (typeof value.reason !== "string") return null;
    const reason = value.reason.trim();
    if (!reason || reason.length > 2000) return null;
    return disputeEvidenceValidationError(value.evidence);
  }
  if (value.type === "evidence") {
    if (typeof value.disputeId !== "string" || !isUuid(value.disputeId)) return null;
    return disputeEvidenceValidationError(value.evidence, true);
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const validationFailure = {
  status: "error",
  errorCode: "VALIDATION_FAILED",
  httpStatus: 400,
} as const;

const assignmentNotFound = {
  status: "error",
  errorCode: "JOB_ASSIGNMENT_NOT_FOUND",
  httpStatus: 404,
  detail: null,
} as const;
