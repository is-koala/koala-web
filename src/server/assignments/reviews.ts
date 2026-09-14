import "server-only";

import type { AssignmentReview } from "@/assignments/review";
import { ApiError } from "@/server/api/errors";
import { clean } from "@/server/api/dto";
import { backendPaths } from "@/server/contract";
import { apiRequest } from "@/server/session/session";

/**
 * `POST /job-assignments/{assignmentId}/reviews` — iki kabuğun ortak yazma ucu.
 *
 * Backend yazarı oturumdan, konuyu atamanın öbür tarafından çözüyor
 * (`ReviewManager.resolveSubject`); işçi de işveren de aynı gövdeyi yollar.
 * Çalışan kabuğu (`work-detail.ts`) bunu yeniden dışa veriyor ki eski
 * çağıranı değişmesin; işveren kabuğu doğrudan buradan okur.
 */

/** Backend'in 409'u: bu yazar bu atamayı zaten değerlendirmiş (`ReviewMessages.ALREADY_REVIEWED`). */
export const alreadyReviewedErrorCode = "REVIEW_ALREADY_REVIEWED";

/** `ReviewDto`; ekranda yalnız puan, yorum ve an okunuyor. `author` yazarın kendisi. */
export type ReviewDto = {
  id?: string | null;
  author?: { id?: string | null } | null;
  rating?: number | null;
  comment?: string | null;
  anonymous?: boolean | null;
  createdAt?: string | null;
};

export async function createAssignmentReview(
  assignmentId: string,
  rating: number,
  comment: string,
): Promise<AssignmentReview> {
  const created = await apiRequest<ReviewDto | null>(
    `${backendPaths.jobAssignments}/${assignmentId}/reviews`,
    {
      method: "POST",
      body: { rating, comment, anonymous: false },
    },
  );
  // Yanıt zarfı boş dönerse ekran gönderdiğini gösterir; backend gövdeyi
  // olduğu gibi kaydediyor, uydurma değil.
  return {
    rating: typeof created?.rating === "number" ? created.rating : rating,
    comment: clean(created?.comment) ?? clean(comment),
    createdAt: clean(created?.createdAt),
  };
}

export function isAlreadyReviewed(error: unknown): error is ApiError {
  return error instanceof ApiError && error.errorCode === alreadyReviewedErrorCode;
}
