"use client";

import type { FormEvent } from "react";

import type { WorkDetail, WorkDetailCommand } from "@/assignments/work-detail";
import { canCancelAssignment, showsCancellationPreview } from "@/assignments/resolution";

import { canOpenDispute, formatNotice } from "./presenters";

export function WorkSecondaryActions({
  detail,
  pending,
  onCommand,
}: {
  detail: WorkDetail;
  pending: boolean;
  onCommand: (command: WorkDetailCommand, notice?: string) => void;
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
  const canReview = detail.assignment.status === "COMPLETED";
  const showDispute = canOpenDispute(detail);
  if (!showsCancellation && !showDispute && !canReview) return null;

  return (
    <section className="work-detail-section work-secondary-actions" aria-labelledby="other-actions-heading">
      <h2 id="other-actions-heading">Diğer işlemler</h2>
      {showsCancellation && preview ? (
        <details>
          <summary>İptal önizlemesi</summary>
          <div className="work-action-body">
            <dl className="cancellation-facts">
              <div><dt>Başlangıca kalan</dt><dd>{formatNotice(preview.noticeMinutes)}</dd></div>
            </dl>
            <p className="muted">
              Onayladığında bu atamadaki çalışmadan çekilmiş olursun.
            </p>
            <ActionForm
              label="İptal nedeni"
              button="Atamayı iptal et"
              maxLength={1000}
              pending={pending}
              onSubmit={(reason) => onCommand({ type: "cancel", reason }, "Atama iptal edildi.")}
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
              onSubmit={(reason) => onCommand({ type: "dispute", reason }, "Uyuşmazlık kaydın alındı.")}
            />
          </div>
        </details>
      ) : null}

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
              <textarea id="review-comment" name="comment" maxLength={2000} rows={4} />
            </div>
            <button className="button button-secondary button-small" disabled={pending}>Değerlendirmeyi gönder</button>
          </form>
        </details>
      ) : null}
    </section>
  );
}

function ActionForm({
  label,
  button,
  maxLength,
  pending,
  onSubmit,
  blockedReason = null,
}: {
  label: string;
  button: string;
  maxLength: number;
  pending: boolean;
  onSubmit: (reason: string) => void;
  /** Eylem kapalıysa nedeni; açıkken `null`. Kapalı form gizlenmiyor. */
  blockedReason?: string | null;
}) {
  const id = `reason-${maxLength}`;
  const blocked = blockedReason !== null;
  return (
    <form className="form compact-form" onSubmit={(event) => submitReason(event, onSubmit)}>
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <textarea id={id} name="reason" required maxLength={maxLength} rows={4} disabled={blocked} />
      </div>
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
  onSubmit: (reason: string) => void,
) {
  event.preventDefault();
  const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
  onSubmit(reason);
}

function submitReview(
  event: FormEvent<HTMLFormElement>,
  onCommand: (command: WorkDetailCommand, notice?: string) => void,
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
