"use client";

import { useActionState, useId, useState } from "react";

import {
  idleReviewActionState,
  ratingStars,
  reviewCommentMaxLength,
  reviewRatings,
  reviewSummary,
  type AssignmentReview,
  type ReviewAction,
  type ReviewRating,
} from "@/assignments/review";
import { errorPresentation } from "@/lib/errors";

/**
 * İşverenin tamamlanan atamada işçiyi değerlendirdiği bölüm.
 *
 * Üç hâli var ve üçü de aynı bölümde: form, yeni yazılan değerlendirme
 * ("Değerlendirmeniz: ★4 · yorum") ve "zaten değerlendirdiniz". Çizilip
 * çizilmeyeceğine çağıran karar veriyor (`canReviewAssignment`); bileşen
 * atama durumunu bilmiyor.
 *
 * Yıldızlar bir radyo grubu: beş `input[type=radio]` görsel olarak yıldız
 * etiketinin arkasında duruyor ama sekmeyle gezilebiliyor, ok tuşlarıyla
 * değişiyor ve her birinin adı "N yıldız". Seçili puana kadar olan yıldızlar
 * dolu çiziliyor; bunun için seçim istemci durumunda tutuluyor, CSS kardeş
 * seçicileriyle "önceki"ler seçilemiyor.
 */
export function AssignmentReviewSection({
  workerName,
  action,
}: {
  workerName: string;
  action: ReviewAction;
}) {
  const [state, submit, pending] = useActionState(action, idleReviewActionState);
  const [selected, setSelected] = useState<ReviewRating | null>(null);
  const [hovered, setHovered] = useState<ReviewRating | null>(null);
  const groupId = useId();
  const commentId = `${groupId}-comment`;

  return (
    <section className="work-detail-section assignment-review" aria-labelledby="assignment-review-title">
      <h2 id="assignment-review-title">İşçiyi değerlendir</h2>

      {state.status === "done" ? (
        <ReviewSummary review={state.review} />
      ) : state.status === "reviewed" ? (
        <p role="status" className="work-location-notice" data-testid="assignment-review-existing">
          Bu atamayı daha önce değerlendirdiniz. Her atama için tek değerlendirme bırakılabilir.
        </p>
      ) : (
        <form action={submit} className="form compact-form assignment-review-form">
          <p className="muted">
            {workerName} ile çalışmanız nasıldı? Puanınız işçinin profilinde ve rozetlerinde
            görünür; yorum isteğe bağlıdır.
          </p>

          <fieldset className="rating-field" aria-describedby={`${groupId}-hint`}>
            <legend>Puan</legend>
            <div
              className="rating-stars"
              onMouseLeave={() => setHovered(null)}
            >
              {reviewRatings.map((rating) => {
                const id = `${groupId}-rating-${rating}`;
                const filled = rating <= (hovered ?? selected ?? 0);
                return (
                  <span
                    key={rating}
                    className="rating-star"
                    onMouseEnter={() => setHovered(rating)}
                  >
                    <input
                      id={id}
                      type="radio"
                      name="rating"
                      value={rating}
                      required
                      checked={selected === rating}
                      onChange={() => setSelected(rating)}
                      onFocus={() => setHovered(null)}
                      disabled={pending}
                    />
                    <label htmlFor={id} data-filled={filled ? "true" : undefined}>
                      <span aria-hidden="true">{filled ? "★" : "☆"}</span>
                      <span className="visually-hidden">{`${rating} yıldız`}</span>
                    </label>
                  </span>
                );
              })}
            </div>
            <p id={`${groupId}-hint`} className="field-hint">
              {selected === null ? "1 ile 5 arasında bir puan seçin." : `${selected} / 5`}
            </p>
          </fieldset>

          <div className="field">
            <label htmlFor={commentId}>Yorum (isteğe bağlı)</label>
            <textarea
              id={commentId}
              name="comment"
              rows={4}
              maxLength={reviewCommentMaxLength}
              disabled={pending}
            />
            <p className="field-hint">En fazla {reviewCommentMaxLength} karakter.</p>
          </div>

          {state.status === "error" ? (
            <p role="alert" className="form-warning">
              {reviewErrorMessage(state.errorCode, state.httpStatus)}
            </p>
          ) : null}

          <button className="button button-primary" disabled={pending}>
            {pending ? "Gönderiliyor" : "Değerlendirmeyi gönder"}
          </button>
        </form>
      )}
    </section>
  );
}

function ReviewSummary({ review }: { review: AssignmentReview }) {
  return (
    <p role="status" className="assignment-review-summary" data-testid="assignment-review-summary">
      <span aria-hidden="true" className="assignment-review-stars">{ratingStars(review.rating)}</span>
      <span>{reviewSummary(review)}</span>
    </p>
  );
}

/**
 * Değerlendirmenin üç reddi.
 *
 * `REVIEW_WORK_NOT_COMPLETED` `conflict` ailesinde ve aile metni ("başka bir
 * duruma geçmiş olabilir") doğru ama neyin yapılacağını söylemiyor; burada
 * söyleniyor. Öbürleri kataloğa düşer.
 */
function reviewErrorMessage(errorCode: string, httpStatus: number): string {
  if (errorCode === "REVIEW_WORK_NOT_COMPLETED") {
    return "Atama tamamlanmadan değerlendirme yapılamaz. Atamanın durumu siz bakarken değişmiş olabilir; sayfayı yenileyip güncel durumu görün.";
  }
  if (errorCode === "REVIEW_RATING_RANGE" || errorCode === "VALIDATION_FAILED") {
    return `Puan 1 ile 5 arasında olmalı; yorum en fazla ${reviewCommentMaxLength} karakter.`;
  }
  if (errorCode === "JOB_ASSIGNMENT_NOT_FOUND" || errorCode === "REVIEW_ASSIGNMENT_NOT_FOUND") {
    return "Atama bulunamadı veya erişim yetkiniz yok.";
  }
  return errorPresentation(errorCode, httpStatus).message;
}
