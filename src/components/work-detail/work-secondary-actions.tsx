"use client";

import type { FormEvent } from "react";

import type { WorkDetail, WorkDetailCommand } from "@/assignments/work-detail";
import { canCancelAssignment } from "@/assignments/resolution";

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
  const canCancel = canCancelAssignment({
    assignmentStatus: detail.assignment.status,
    resolution: detail.resolution,
  });
  const canReview = detail.assignment.status === "COMPLETED";
  const showDispute = canOpenDispute(detail);
  if (!canCancel && !showDispute && !canReview) return null;

  return (
    <section className="work-detail-section work-secondary-actions" aria-labelledby="other-actions-heading">
      <h2 id="other-actions-heading">Diğer işlemler</h2>
      {canCancel && preview ? (
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
}: {
  label: string;
  button: string;
  maxLength: number;
  pending: boolean;
  onSubmit: (reason: string) => void;
}) {
  const id = `reason-${maxLength}`;
  return (
    <form className="form compact-form" onSubmit={(event) => submitReason(event, onSubmit)}>
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <textarea id={id} name="reason" required maxLength={maxLength} rows={4} />
      </div>
      <button className="button button-danger button-small" disabled={pending}>{button}</button>
    </form>
  );
}

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
