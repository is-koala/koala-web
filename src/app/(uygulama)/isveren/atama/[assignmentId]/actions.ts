"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import type { CompletionActionState } from "@/assignments/employer-tracking";
import {
  disputeEvidenceFilesFromFormData,
  disputeEvidenceFormValidationError,
  disputeEvidenceUploadFeedback,
  type DisputeEvidenceUploadResult,
  type ResolutionActionState,
} from "@/assignments/resolution";
import { isUuid } from "@/lib/identifiers";
import { completeAssignment } from "@/server/assignments/employer-tracking";
import {
  cancelAssignment,
  createAssignmentDispute,
  createAssignmentDisputeWithEvidence,
  uploadAssignmentDisputeEvidence,
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
  const disputeId = textField(formData, "disputeId").trim();
  const evidenceError = disputeEvidenceFormValidationError(
    formData,
    operation === "evidence",
  );
  const files = disputeEvidenceFilesFromFormData(formData);
  if (
    !isUuid(assignmentId) ||
    (operation !== "cancel" && operation !== "dispute" && operation !== "evidence") ||
    (operation !== "evidence" && (!reason || reason.length > maxLength)) ||
    (operation === "evidence" && !isUuid(disputeId))
  ) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }
  if (evidenceError !== null) {
    return { status: "error", errorCode: evidenceError, httpStatus: 400 };
  }
  if (files === null) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  try {
    let upload: DisputeEvidenceUploadResult | null = null;
    if (operation === "cancel") {
      await cancelAssignment(assignmentId, reason);
    } else if (operation === "dispute" && files.length === 0) {
      await createAssignmentDispute(assignmentId, reason);
    } else if (operation === "dispute") {
      upload = await createAssignmentDisputeWithEvidence(assignmentId, reason, files);
    } else {
      upload = await uploadAssignmentDisputeEvidence(disputeId, files);
    }
    revalidatePath(`/isveren/atama/${assignmentId}`);
    if (upload) {
      const feedback = disputeEvidenceUploadFeedback(operation === "dispute", upload);
      return feedback.kind === "warning"
        ? { status: "partial", message: feedback.message }
        : { status: "done", message: feedback.message };
    }
    return {
      status: "done",
      message: operation === "cancel"
        ? "Atama iptal edildi. Güncel iade durumu sayfada gösteriliyor."
        : "Uyuşmazlık kaydınız alındı.",
    };
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureView(error);
    if (failure.httpStatus === 404 || failure.httpStatus === 409) {
      revalidatePath(`/isveren/atama/${assignmentId}`);
    }
    return { status: "error", ...failure };
  }
}

/**
 * "İşi tamamlandı işaretle".
 *
 * Geçişin mümkün olup olmadığına burada karar verilmiyor. Sunucu iki koşul
 * arıyor — ödeme emanette ve durum `CONFIRMED`/`IN_PROGRESS` — ve ikisi de
 * atama satırından okunabildiği için ekran düğmeyi zaten kapatıyor. Bu action
 * yalnız isteği taşıyor ve reddi `errorCode` olarak geri veriyor: kullanıcı
 * ekranı açık tutarken durum değişmiş olabilir.
 */
export async function completeAssignmentAction(
  assignmentId: string,
  _state: CompletionActionState,
  formData: FormData,
): Promise<CompletionActionState> {
  void _state;
  void formData;
  await requireSessionForCurrentPath();

  if (!isUuid(assignmentId)) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  try {
    await completeAssignment(assignmentId);
    revalidatePath(`/isveren/atama/${assignmentId}`);
    return { status: "done" };
  } catch (error) {
    unstable_rethrow(error);
    // İki red de atamanın durumunun bu sırada değişmiş olmasından gelebiliyor;
    // kullanıcı hatayı okurken ekranda bayat bir durum görmemeli.
    revalidatePath(`/isveren/atama/${assignmentId}`);
    return { status: "error", ...failureView(error) };
  }
}
