"use client";

import { useActionState } from "react";

import {
  canCancelAssignment,
  canOpenAssignmentDispute,
  hasActiveDispute,
  type AssignmentResolution,
  type ResolutionActionState,
} from "@/assignments/resolution";
import { formatMoney } from "@/lib/money";

type ResolutionAction = (
  state: ResolutionActionState,
  formData: FormData,
) => Promise<ResolutionActionState>;

export function EmployerResolutionActions({
  assignmentStatus,
  paymentStatus,
  resolution,
  currency,
  action,
}: {
  assignmentStatus: string;
  paymentStatus: string;
  resolution: AssignmentResolution;
  currency: string;
  action: ResolutionAction;
}) {
  const [state, submit, pending] = useActionState(action, { status: "idle" });
  const preview = resolution.cancellationPreview;
  const canCancel = canCancelAssignment({ assignmentStatus, resolution });
  const activeDispute = hasActiveDispute(resolution);
  const canDispute = canOpenAssignmentDispute({ assignmentStatus, paymentStatus, resolution });

  if (!canCancel && !canDispute && !activeDispute) return null;

  return (
    <section className="work-detail-section work-secondary-actions" aria-labelledby="employer-resolution-actions-title">
      <h2 id="employer-resolution-actions-title">İşlemler</h2>

      {state.status === "done" ? <p role="status" className="work-location-notice">{state.message}</p> : null}
      {state.status === "error" ? (
        <p role="alert" className="form-warning">{resolutionErrorMessage(state.errorCode)}</p>
      ) : null}

      {canCancel && preview ? (
        <details>
          <summary>Atamayı iptal et</summary>
          <div className="work-action-body">
            <p className="muted">
              Onaylamadan önce kesinti ve iade tutarını kontrol edin. Bu tutarlar
              sunucunun güncel iptal kuralından gelir.
            </p>
            <dl className="cancellation-facts">
              <div><dt>İptal kesintisi</dt><dd>{formatMoney(preview.feeAmount, currency)}</dd></div>
              <div><dt>İade</dt><dd>{formatMoney(preview.refundAmount, currency)}</dd></div>
            </dl>
            <ReasonForm
              operation="cancel"
              label="İptal nedeni"
              button="Atamayı iptal et"
              maxLength={1000}
              action={submit}
              pending={pending}
            />
          </div>
        </details>
      ) : null}

      {canDispute ? (
        <details>
          <summary>Uyuşmazlık aç</summary>
          <div className="work-action-body">
            <p className="muted">
              Sorunu ve eldeki kanıtı açıkça anlatın. İnceleme süresince emanet
              tutarı dondurulur.
            </p>
            <ReasonForm
              operation="dispute"
              label="Gerekçe ve kanıt açıklaması"
              button="Uyuşmazlık aç"
              maxLength={2000}
              action={submit}
              pending={pending}
            />
          </div>
        </details>
      ) : null}

      {activeDispute ? (
        <p className="muted">Mevcut uyuşmazlık sonuçlanana kadar yeni bir kayıt açılamaz.</p>
      ) : null}
    </section>
  );
}

function ReasonForm({
  operation,
  label,
  button,
  maxLength,
  action,
  pending,
}: {
  operation: "cancel" | "dispute";
  label: string;
  button: string;
  maxLength: number;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const id = `employer-${operation}-reason`;
  return (
    <form className="form compact-form" action={action}>
      <input type="hidden" name="operation" value={operation} />
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <textarea id={id} name="reason" required maxLength={maxLength} rows={4} />
      </div>
      <button className="button button-danger button-small" disabled={pending}>{button}</button>
    </form>
  );
}

function resolutionErrorMessage(errorCode: string): string {
  if (errorCode === "VALIDATION_FAILED") return "Geçerli bir gerekçe yazın.";
  if (errorCode === "CANCELLATION_ALREADY_CANCELLED") return "Bu atama zaten iptal edildi.";
  if (errorCode === "DISPUTE_ALREADY_OPEN") return "Bu atamada zaten açık bir uyuşmazlık var.";
  if (errorCode === "JOB_ASSIGNMENT_NOT_FOUND") return "Atama bulunamadı veya erişim yetkiniz yok.";
  return "İşlem tamamlanamadı. Güncel durumu kontrol edip yeniden deneyin.";
}
