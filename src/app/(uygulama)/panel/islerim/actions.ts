"use server";

import { unstable_rethrow } from "next/navigation";

import type { AssignmentResponseState } from "@/assignments/contract";
import { failureView } from "@/server/form";
import {
  readWorkerAssignments,
  respondToWorkerAssignment,
} from "@/server/assignments/assignments";
import { requireSessionForCurrentPath } from "@/server/session/guard";

const uuidPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Atama cevabının sunucu sınırı.
 *
 * Başarılı POST'un dar yanıtı liste görünümünü kurmaya yetmez. Bu nedenle
 * durumu istemcide tahmin etmez, aynı çalışan listesini yeniden okuyup tek
 * turda geri yollar.
 */
export async function respondAssignmentAction(
  state: AssignmentResponseState,
  formData: FormData,
): Promise<AssignmentResponseState> {
  await requireSessionForCurrentPath();

  const assignmentId = stringField(formData, "assignmentId");
  const decision = stringField(formData, "decision");
  if (!uuidPattern.test(assignmentId) || (decision !== "accept" && decision !== "reject")) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  try {
    await respondToWorkerAssignment(assignmentId, decision === "accept");
    return { status: "done", assignments: await readWorkerAssignments() };
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

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
