"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import type { ResolutionActionState } from "@/assignments/resolution";
import { isUuid } from "@/lib/identifiers";
import {
  cancelAssignment,
  createAssignmentDispute,
} from "@/server/assignments/resolution";
import { failureView, textField } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";

export async function employerResolutionAction(
  assignmentId: string,
  _state: ResolutionActionState,
  formData: FormData,
): Promise<ResolutionActionState> {
  void _state;
  await requireSessionForCurrentPath();

  const operation = textField(formData, "operation");
  const reason = textField(formData, "reason").trim();
  const maxLength = operation === "cancel" ? 1000 : 2000;
  if (
    !isUuid(assignmentId) ||
    (operation !== "cancel" && operation !== "dispute") ||
    !reason ||
    reason.length > maxLength
  ) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  try {
    if (operation === "cancel") {
      await cancelAssignment(assignmentId, reason);
    } else {
      await createAssignmentDispute(assignmentId, reason);
    }
    revalidatePath(`/isveren/atama/${assignmentId}`);
    return {
      status: "done",
      message: operation === "cancel"
        ? "Atama iptal edildi. Güncel iade durumu sayfada gösteriliyor."
        : "Uyuşmazlık kaydınız alındı.",
    };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", ...failureView(error) };
  }
}
