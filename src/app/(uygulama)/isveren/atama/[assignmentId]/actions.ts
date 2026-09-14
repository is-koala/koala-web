"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import type { CompletionActionState } from "@/assignments/employer-tracking";
import {
  parseReviewRating,
  reviewCommentMaxLength,
  type ReviewActionState,
} from "@/assignments/review";
import {
  disputeEvidenceFilesFromFormData,
  disputeEvidenceFormValidationError,
  disputeEvidenceUploadFeedback,
  type DisputeEvidenceUploadResult,
  type ResolutionActionState,
} from "@/assignments/resolution";
import { isUuid } from "@/lib/identifiers";
import type { ConversationState } from "@/messaging/contract";
import { openApplicantConversation } from "@/server/applications/employer-review";
import { completeAssignment } from "@/server/assignments/employer-tracking";
import {
  cancelAssignment,
  createAssignmentDispute,
  createAssignmentDisputeWithEvidence,
  uploadAssignmentDisputeEvidence,
} from "@/server/assignments/resolution";
import { createAssignmentReview, isAlreadyReviewed } from "@/server/assignments/reviews";
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

/**
 * Atama ekranından işçiyle konuşma açma.
 *
 * Aday kartındaki eylemle aynı uç (`POST /jobs/{jobId}/conversation?workerId=`)
 * ve aynı sonuç: kimlik gelir gelmez mesaj kabuğuna yönlendirme. İlan ve
 * işçi kimliği sunucuda okunmuş atamadan bağlanıyor, formdan gelmiyor;
 * yetki denetimi yine backend'de — bağlanan değer de istemciden döner.
 * Kapı (`messagingAvailable`) düğmeyi önden kapatıyor; buradaki 403/409
 * kararın bayatladığı hâl ve metni `errorCode` ile kataloğdan seçiliyor.
 */
export async function employerConversationAction(
  jobId: string,
  workerId: string,
  _state: ConversationState,
  formData: FormData,
): Promise<ConversationState> {
  void _state;
  void formData;
  await requireSessionForCurrentPath();

  if (!isUuid(jobId) || !isUuid(workerId)) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  let conversationId: string;
  try {
    conversationId = await openApplicantConversation(jobId, workerId);
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", ...failureView(error) };
  }

  // `redirect()` istisna atarak çalışıyor; `try` dışında kalmalı.
  redirect(`/isveren/mesajlar/${encodeURIComponent(conversationId)}`);
}

/**
 * "İşçiyi değerlendir".
 *
 * Çalışan kabuğuyla aynı uç ve gövde (`createAssignmentReview`); backend
 * yazarı oturumdan çözüp konuyu işçi yapıyor. Sınırlar `@/assignments/review`
 * içindeki backend DTO sabitleri; ekran da aynı sabitleri okuyor, burada
 * yalnız istemcinin atlattığı gövde durduruluyor.
 *
 * 409 `REVIEW_ALREADY_REVIEWED` bir hata değil, cevap: form kapanır ve
 * "zaten değerlendirdiniz" yazılır. Atama satırı yazarın değerlendirmesini
 * taşımadığı için (`MyAssignmentDto`'da `reviews[]` yok) içerik bilinmiyor;
 * bilinseydi ekran onu sayfa açılır açılmaz gösterirdi. Başarıda yeni
 * değerlendirme yanıttan durumda taşınıyor: sayfa yenilense de sunucudan
 * geri okunacak bir yer yok.
 */
export async function employerReviewAction(
  assignmentId: string,
  _state: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  void _state;
  await requireSessionForCurrentPath();

  const rating = parseReviewRating(textField(formData, "rating"));
  const comment = textField(formData, "comment").trim();
  if (!isUuid(assignmentId) || rating === null || comment.length > reviewCommentMaxLength) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  try {
    const review = await createAssignmentReview(assignmentId, rating, comment);
    revalidatePath(`/isveren/atama/${assignmentId}`);
    return { status: "done", review };
  } catch (error) {
    unstable_rethrow(error);
    if (isAlreadyReviewed(error)) return { status: "reviewed" };
    return { status: "error", ...failureView(error) };
  }
}
