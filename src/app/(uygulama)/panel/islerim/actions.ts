"use server";

import { unstable_rethrow } from "next/navigation";

import type {
  AssignmentAcceptanceState,
  AssignmentResponseState,
} from "@/assignments/contract";
import { isUuid } from "@/lib/identifiers";
import { failureView, textField } from "@/server/form";
import {
  readAssignmentAddress,
  readWorkerAssignments,
  respondToWorkerAssignment,
} from "@/server/assignments/assignments";
import { requireSessionForCurrentPath } from "@/server/session/guard";

export async function respondAssignmentAction(
  state: AssignmentResponseState,
  formData: FormData,
): Promise<AssignmentResponseState> {
  await requireSessionForCurrentPath();

  const decision = textField(formData, "decision");
  const targetPage = pageField(formData, decision === "page" ? "targetPage" : "currentPage");
  if (targetPage === null) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  try {
    if (decision === "page") {
      return { status: "done", assignments: await readWorkerAssignments(targetPage) };
    }

    const assignmentId = textField(formData, "assignmentId");
    if (!isUuid(assignmentId) || (decision !== "accept" && decision !== "reject")) {
      return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
    }
    await respondToWorkerAssignment(assignmentId, decision === "accept");
    return { status: "done", assignments: await readWorkerAssignments(targetPage) };
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureView(error);
    return {
      status: "error",
      errorCode: failure.errorCode,
      httpStatus: failure.httpStatus,
      ...(state.status !== "idle" && state.assignments
        ? { assignments: state.assignments }
        : {}),
    };
  }
}

export async function readAssignmentAcceptanceAction(
  assignmentId: string,
  jobId: string,
): Promise<AssignmentAcceptanceState> {
  await requireSessionForCurrentPath();
  if (!isUuid(assignmentId) || !isUuid(jobId)) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  try {
    return { status: "done", fullAddress: await readAssignmentAddress(jobId) };
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureView(error);
    return { status: "error", errorCode: failure.errorCode, httpStatus: failure.httpStatus };
  }
}

function pageField(formData: FormData, name: string): number | null {
  const raw = textField(formData, name);
  if (raw === "") return 0;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}
