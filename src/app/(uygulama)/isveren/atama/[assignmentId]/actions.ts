"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import type { CompletionActionState } from "@/assignments/employer-tracking";
import type { ResolutionActionState } from "@/assignments/resolution";
import { isUuid } from "@/lib/identifiers";
import { completeAssignment } from "@/server/assignments/employer-tracking";
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
