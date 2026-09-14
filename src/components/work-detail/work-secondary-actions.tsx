"use client";

import type { FormEvent } from "react";

import type {
  WorkDetail,
  WorkDetailActionResult,
  WorkDetailCommand,
} from "@/assignments/work-detail";
import {
  canCancelAssignment,
  showsCancellationPreview,
} from "@/assignments/resolution";
import {
  canReviewAssignment,
  ratingStars,
  reviewCommentMaxLength,
  reviewSummary,
  type AssignmentReview,
} from "@/assignments/review";
import {
  DisputeEvidenceFields,
  selectedDisputeEvidence,
} from "@/components/dispute-evidence-fields";
import { formatDateTime } from "@/lib/dates";

import { canOpenDispute, formatNotice } from "./presenters";

export function WorkSecondaryActions({
  detail,
  pending,
  onCommand,
}: {
  detail: WorkDetail;
  pending: boolean;
  onCommand: CommandRunner;
}) {
  const preview = detail.resolution.cancellationPreview;
  // Görünürlük ile eylem ayrı: blok önizleme geldiği sürece duruyor, gönderme
  // sunucunun `cancellableNow` kararıyla açılıyor. Kapalı bir blok olmayan bir
  // bloktan farklı — işçi neden çekilemediğini ekranda okumalı.
  const showsCancellation = showsCancellationPreview(detail.resolution);
  const canCancel = canCancelAssignment({
    assignmentStatus: detail.assignment.status,
    resolution: detail.resolution,
  });
  // Değerlendirme kararı sunucudan (#179): satır `myReview` taşıyorsa form
  // yerine özet; 409 `REVIEW_ALREADY_REVIEWED` yalnız yarış yedeği.
  const myReview = detail.assignment.myReview;
  const canReview = canReviewAssignment(detail.assignment.status, myReview);
  const showDispute = canOpenDispute(detail);
  const activeDispute = detail.resolution.disputes.find((dispute) => dispute.status !== "RESOLVED");
  if (!showsCancellation && !showDispute && !canReview && !myReview && !activeDispute) return null;

  return (
    <section className="work-detail-section work-secondary-actions" aria-labelledby="other-actions-heading">
      <h2 id="other-actions-heading">Diğer işlemler</h2>
      {showsCancellation && preview ? (
        <details>
          <summary>Çalışmadan çekilme</summary>
          <div className="work-action-body">
            <dl className="cancellation-facts">
              <div><dt>Başlangıca kalan</dt><dd>{formatNotice(preview.noticeMinutes)}</dd></div>
            </dl>
            <p className="muted">
              {detail.assignment.paymentStatus === "HELD_IN_ESCROW"
                ? "Onayladığında atama sona erer; bu atama için ödeme alamazsın ve işverene ödemenin tamamının iade süreci başlar."
                : "Onayladığında atama sona erer ve bu atama için ödeme alamazsın. İşverenden henüz ödeme alınmadığı için iade gerekmez."}
            </p>
            <ActionForm
              label="Çekilme nedeni"
              button="Atamadan çekil"
              maxLength={1000}
              pending={pending}
              onSubmit={(reason) => onCommand({ type: "cancel", reason }, "Atamadan çekildin.")}
              blockedReason={canCancel ? null : cancellationClosedReason}
            />
          </div>
        </details>
      ) : null}

      {showDispute ? (
        <details>
          <summary>Uyuşmazlık aç</summary>
          <div className="work-action-body">
            <p className="muted">Ödeme veya çalışma kaydıyla ilgili sorunu ekibe ilet.</p>
            <ActionForm
              label="Uyuşmazlık nedeni"
              button="Uyuşmazlığı gönder"
              maxLength={2000}
              pending={pending}
              withEvidence
              onSubmit={(reason, evidence) => onCommand(
                evidence.length > 0
                  ? { type: "dispute", reason, evidence }
                  : { type: "dispute", reason },
                "Uyuşmazlık kaydın alındı.",
              )}
            />
          </div>
        </details>
      ) : null}

      {activeDispute ? (
        <EvidenceUploadForm disputeId={activeDispute.id} pending={pending} onCommand={onCommand} />
      ) : null}

      {myReview ? <WorkerReviewSummary review={myReview} /> : null}

      {canReview ? (
        <details>
          <summary>Değerlendirme bırak</summary>
          <form
            className="form compact-form work-action-body"
            onSubmit={(event) => submitReview(event, onCommand)}
          >
            <div className="field">
              <label htmlFor="review-rating">Puan</label>
              <select id="review-rating" name="rating" defaultValue="5">
                {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="review-comment">Yorum</label>
              <textarea id="review-comment" name="comment" maxLength={reviewCommentMaxLength} rows={4} />
            </div>
            <button className="button button-secondary button-small" disabled={pending}>Değerlendirmeyi gönder</button>
          </form>
        </details>
      ) : null}
    </section>
  );
}

/**
 * İşçinin daha önce bıraktığı değerlendirme. Form bu hâlde hiç çizilmiyor;
 * `role="status"` yok, çünkü bu bir duyuru değil sayfayla gelen içerik —
 * gönderim sonrası duyuruyu ekranın üst şeridi ("Değerlendirmen kaydedildi.")
 * yapıyor.
 */
function WorkerReviewSummary({ review }: { review: AssignmentReview }) {
  return (
    <p className="assignment-review-summary" data-testid="work-review-summary">
      <span aria-hidden="true" className="assignment-review-stars">{ratingStars(review.rating)}</span>
      <span>{reviewSummary(review, "informal")}</span>
      {review.createdAt ? (
        <time dateTime={review.createdAt}>{formatDateTime(review.createdAt)}</time>
      ) : null}
    </p>
  );
}

function ActionForm({
  label,
  button,
  maxLength,
  pending,
  onSubmit,
  blockedReason = null,
  withEvidence = false,
}: {
  label: string;
  button: string;
  maxLength: number;
  pending: boolean;
  onSubmit: (reason: string, evidence: readonly File[]) => void;
  /** Eylem kapalıysa nedeni; açıkken `null`. Kapalı form gizlenmiyor. */
  blockedReason?: string | null;
  withEvidence?: boolean;
}) {
  const id = `reason-${maxLength}`;
  const blocked = blockedReason !== null;
  return (
    <form className="form compact-form" onSubmit={(event) => submitReason(event, onSubmit)}>
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <textarea id={id} name="reason" required maxLength={maxLength} rows={4} disabled={blocked} />
      </div>
      {withEvidence ? (
        <DisputeEvidenceFields id="worker-dispute-evidence" label="Kanıt dosyaları (isteğe bağlı)" />
      ) : null}
      <button
        className="button button-danger button-small"
        disabled={blocked || pending}
        data-disabled-kind={blocked ? "permanent" : undefined}
      >
        {button}
      </button>
      {blockedReason ? <p className="muted">{blockedReason}</p> : null}
    </form>
  );
}

function EvidenceUploadForm({
  disputeId,
  pending,
  onCommand,
}: {
  disputeId: string;
  pending: boolean;
  onCommand: CommandRunner;
}) {
  return (
    <form
      className="form compact-form"
      onSubmit={(event) => void submitEvidence(event, disputeId, onCommand)}
    >
      <DisputeEvidenceFields id={`worker-evidence-${disputeId}`} label="Yeni kanıt dosyaları" required />
      <button className="button button-secondary button-small" disabled={pending}>
        Kanıtları yükle
      </button>
    </form>
  );
}

/**
 * `cancellableNow: false` iken işçinin okuduğu neden.
 *
 * Sunucu bayrağı üç koşuldan biriyle düşürüyor
 * (`CancellationManager.java:138-140`): atamanın durumu artık iptal edilebilir
 * kümede değil, atamanın zaten bir iptal kaydı var, ya da açık bir uyuşmazlık
 * var. Üçüncüsünde blok hiç çizilmiyor — gerekçesi bölümün üstündeki kalıcı
 * şeritte yazılı; kalan ikisi işçiye aynı şeyi söylüyor: sunucudaki atama
 * ekrandakinden yeni.
 *
 * İşverenin metni kopyalanmıyor. O ekran kesinti ve iade tutarını konuşuyor;
 * işçinin gördüğü tek sayı başlangıca kalan süre ve yaptığı şey iptal etmek
 * değil işten çekilmek.
 */
const cancellationClosedReason =
  "Şu anda bu atamadan çekilemezsin: atama iptal edilmiş ya da durumu sen bakarken değişmiş olabilir. Sayfayı yenileyip güncel duruma bak.";

function submitReason(
  event: FormEvent<HTMLFormElement>,
  onSubmit: (reason: string, evidence: readonly File[]) => void,
) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const reason = String(form.get("reason") ?? "");
  onSubmit(reason, selectedDisputeEvidence(event.currentTarget));
}

type CommandRunner = (
  command: WorkDetailCommand,
  notice?: string,
) => Promise<WorkDetailActionResult>;

async function submitEvidence(
  event: FormEvent<HTMLFormElement>,
  disputeId: string,
  onCommand: CommandRunner,
) {
  event.preventDefault();
  const form = event.currentTarget;
  const files = selectedDisputeEvidence(form);
  const result = await onCommand(
    { type: "evidence", disputeId, evidence: files },
    `${files.length} kanıt dosyası yüklendi.`,
  );
  if (result.status === "done") {
    form.reset();
    const input = form.elements.namedItem("evidence");
    if (input instanceof HTMLInputElement) input.value = "";
  }
}

function submitReview(
  event: FormEvent<HTMLFormElement>,
  onCommand: CommandRunner,
) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  onCommand(
    {
      type: "review",
      rating: Number(form.get("rating")),
      comment: String(form.get("comment") ?? ""),
    },
    "Değerlendirmen kaydedildi.",
  );
}
