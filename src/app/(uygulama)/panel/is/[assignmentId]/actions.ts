"use server";

import { unstable_rethrow } from "next/navigation";

import type {
  WorkDetail,
  WorkDetailActionResult,
  WorkDetailCommand,
} from "@/assignments/work-detail";
import { isUuid } from "@/lib/identifiers";
import {
  cancelAssignment,
  checkpoint,
  createAssignmentDispute,
  createAssignmentReview,
  readWorkDetail,
} from "@/server/assignments/work-detail";
import { failureView } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";

export async function workDetailAction(
  assignmentId: string,
  command: WorkDetailCommand,
): Promise<WorkDetailActionResult> {
  await requireSessionForCurrentPath();
  const validated = validateCommand(command);
  if (!isUuid(assignmentId) || !validated) return validationFailure;

  try {
    await execute(assignmentId, validated);
    const detail = await readWorkDetail(assignmentId);
    return detail ? { status: "done", detail } : assignmentNotFound;
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

async function execute(assignmentId: string, command: WorkDetailCommand): Promise<void> {
  switch (command.type) {
    case "refresh":
      return;
    case "checkpoint":
      return checkpoint(assignmentId, command.kind, command.point);
    case "cancel":
      return cancelAssignment(assignmentId, command.reason);
    case "dispute":
      return createAssignmentDispute(assignmentId, command.reason);
    case "review":
      return createAssignmentReview(
        assignmentId,
        command.rating,
        command.comment,
      );
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
    return { type: value.type, reason };
  }

  if (value.type === "review") {
    if (
      typeof value.rating !== "number" ||
      !Number.isInteger(value.rating) ||
      value.rating < 1 ||
      value.rating > 5 ||
      typeof value.comment !== "string" ||
      value.comment.length > 2000
    ) return null;
    return { type: "review", rating: value.rating, comment: value.comment.trim() };
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
