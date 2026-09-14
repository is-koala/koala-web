"use client";

import { startTransition, useActionState, useId, useState, type FormEvent } from "react";

import { assignmentNotFoundMessage } from "@/assignments/contract";

import {
  idleReviewActionState,
  reviewCommentMaxLength,
  reviewRatings,
  type AssignmentReview,
  type ReviewAction,
  type ReviewRating,
} from "@/assignments/review";
import { ReviewSummary } from "@/components/review-summary";
import { StatusBadge } from "@/components/ui";
import { errorPresentation } from "@/lib/errors";

/**
 * İşverenin tamamlanan atamada işçiyi değerlendirdiği bölüm.
 *
 * Dört hâli var ve dördü de aynı bölümde: form, satırdan gelen mevcut
 * değerlendirme (`existing`, backend 0.9.25 `myReview` — yükleme anında
 * form hiç çizilmez), yeni yazılan değerlendirme ("Değerlendirmeniz: ★4 ·
 * yorum") ve 409'dan gelen "zaten değerlendirdiniz" (içeriği bilinmeyen
 * yarış yedeği). Bölümün çizilip çizilmeyeceğine çağıran karar veriyor
 * (`COMPLETED`); bileşen atama durumunu bilmiyor.
 *
 * `counterpartyReviewed` yalnız bir rozet: işçinin puanı ve yorumu buraya
 * gelmiyor, "işçi sizi değerlendirdi" bilgisi yetiyor. Alan yoksa (eski
 * sunucu) rozet de yok.
 *
 * Yıldızlar bir radyo grubu: beş `input[type=radio]` görsel olarak yıldız
 * etiketinin arkasında duruyor ama sekmeyle gezilebiliyor, ok tuşlarıyla
 * değişiyor ve her birinin adı "N yıldız". Seçili puana kadar olan yıldızlar
 * dolu çiziliyor; bunun için seçim istemci durumunda tutuluyor, CSS kardeş
 * seçicileriyle "önceki"ler seçilemiyor.
 *
 * Form `action={submit}` ile değil `onSubmit` + `startTransition` ile
 * gönderiliyor. React 19 `<form action>` gönderim biter bitmez formu
 * **koşulsuz** sıfırlıyor — hata döndüğünde de: yazılan yorum siliniyor ve
 * radyonun DOM işareti kalkıyor (durum hâlâ "4 / 5" derken `required` radyo
 * boş kalıyor, ikinci gönderim tarayıcıda takılıyordu). Sıfırlama olmayınca
 * hata sonrası alanlar olduğu gibi duruyor; iki alan yine de durumda tutuluyor
 * ki çizim tek kaynaktan gelsin.
 */
export function AssignmentReviewSection({
  workerName,
  action,
  existing = null,
  counterpartyReviewed = null,
}: {
  workerName: string;
  action: ReviewAction;
  existing?: AssignmentReview | null;
  counterpartyReviewed?: boolean | null;
}) {
  const [state, dispatch, pending] = useActionState(action, idleReviewActionState);
  const [selected, setSelected] = useState<ReviewRating | null>(null);
  const [hovered, setHovered] = useState<ReviewRating | null>(null);
  const [comment, setComment] = useState("");
  const groupId = useId();
  const commentId = `${groupId}-comment`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return (
    <section className="work-detail-section assignment-review" aria-labelledby="assignment-review-title">
      <div className="assignment-card-topline">
        <h2 id="assignment-review-title">İşçiyi değerlendir</h2>
        {counterpartyReviewed ? (
          <StatusBadge tone="info" data-testid="counterparty-reviewed">İşçi sizi değerlendirdi</StatusBadge>
        ) : null}
      </div>

      {state.status === "done" ? (
        <ReviewSummary review={state.review} live />
      ) : existing ? (
        <ReviewSummary review={existing} />
      ) : state.status === "reviewed" ? (
        <p role="status" className="work-location-notice" data-testid="assignment-review-existing">
          Bu atamayı daha önce değerlendirdiniz. Her atama için tek değerlendirme bırakılabilir.
        </p>
      ) : (
        <form onSubmit={submit} className="form compact-form assignment-review-form">
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
              value={comment}
              onChange={(event) => setComment(event.target.value)}
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

/**
 * Değerlendirmenin üç reddi.
 *
 * `REVIEW_WORK_NOT_COMPLETED` `conflict` ailesinde ve aile metni ("başka bir
 * duruma geçmiş olabilir") doğru ama neyin yapılacağını söylemiyor; burada
 * söyleniyor. `REVIEW_ASSIGNMENT_NOT_FOUND` backend'in bu uçtaki adı, cümle
 * öbür eylemlerle aynı. Öbürleri kataloğa düşer.
 */
function reviewErrorMessage(errorCode: string, httpStatus: number): string {
  if (errorCode === "REVIEW_WORK_NOT_COMPLETED") {
    return "Atama tamamlanmadan değerlendirme yapılamaz. Atamanın durumu siz bakarken değişmiş olabilir; sayfayı yenileyip güncel durumu görün.";
  }
  if (errorCode === "REVIEW_RATING_RANGE" || errorCode === "VALIDATION_FAILED") {
    return `Puan 1 ile 5 arasında olmalı; yorum en fazla ${reviewCommentMaxLength} karakter.`;
  }
  if (errorCode === "JOB_ASSIGNMENT_NOT_FOUND" || errorCode === "REVIEW_ASSIGNMENT_NOT_FOUND") {
    return assignmentNotFoundMessage;
  }
  return errorPresentation(errorCode, httpStatus).message;
}
