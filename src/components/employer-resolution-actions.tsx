"use client";

import { useActionState } from "react";

import {
  canCancelAssignment,
  canOpenAssignmentDispute,
  hasActiveDispute,
  type AssignmentResolution,
  type ResolutionActionState,
} from "@/assignments/resolution";
import { formatNotice, formatRate } from "@/components/work-detail/presenters";
import { assignmentErrorMessage } from "@/components/assignment-error-message";
import { formatMoney } from "@/lib/money";

import { DisputeEvidenceFields } from "./dispute-evidence-fields";

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
  const activeDisputeRecord = resolution.disputes.find((dispute) => dispute.status !== "RESOLVED");
  const canDispute = canOpenAssignmentDispute({ assignmentStatus, paymentStatus, resolution });
  /*
    Önizleme `cancellableNow: false` iken de çiziliyor, gizlenmiyor.
    `GET .../cancellation-preview` bu durumda 409 değil **200 + tutarlar**
    döndürüyor (`CancellationManager.previewCancellation`): "iptal edemezsin"
    sunucunun bir hatası değil, cevabının bir parçası ve kesinti/iade
    rakamları yanında geliyor. Blok kaybolsaydı kullanıcı ekranda ne
    kesileceğini de neden iptal edemediğini de okuyamaz, düğmeyi arar dururdu.
    Açık uyuşmazlık ayrı tutuluyor: onun gerekçesi bölümün altında kendi
    kalıcı şeridinde yazılı ve burada tekrar edilmesi gerekmiyor.
  */
  const showsCancellation = preview !== null && !activeDispute;

  if (!showsCancellation && !canDispute && !activeDispute) return null;

  return (
    <section className="work-detail-section work-secondary-actions" aria-labelledby="employer-resolution-actions-title">
      <h2 id="employer-resolution-actions-title">İşlemler</h2>

      {state.status === "done" ? <p role="status" className="work-location-notice">{state.message}</p> : null}
      {state.status === "partial" ? <p role="alert" className="form-warning">{state.message}</p> : null}
      {state.status === "error" ? (
        <p role="alert" className="form-warning">
          {resolutionErrorMessage(state.errorCode, state.httpStatus)}
        </p>
      ) : null}

      {showsCancellation && preview ? (
        <details>
          <summary>Atamayı iptal et</summary>
          <div className="work-action-body">
            <p className="muted">
              Onaylamadan önce kesinti ve iade tutarını kontrol edin. Bu tutarlar
              sunucunun güncel iptal kuralından gelir.
            </p>
            {/*
              Dört alan birlikte duruyor: tutarlar ne kesileceğini söylüyor,
              oran nasıl hesaplandığını, ihbar süresi ise beklemenin sonucu
              değiştirip değiştirmeyeceğini. Biri eksik kalırsa kullanıcı geri
              alınamaz bir karara eksik bakarak varır.
            */}
            <dl className="cancellation-facts">
              <div><dt>İptal kesintisi</dt><dd>{formatMoney(preview.feeAmount, currency)}</dd></div>
              <div><dt>İptal kesintisi oranı</dt><dd>{formatRate(preview.feeRate)}</dd></div>
              <div><dt>İade</dt><dd>{formatMoney(preview.refundAmount, currency)}</dd></div>
              <div><dt>Başlangıca kalan</dt><dd>{formatNotice(preview.noticeMinutes)}</dd></div>
            </dl>
            <ReasonForm
              operation="cancel"
              label="İptal nedeni"
              button="Atamayı iptal et"
              maxLength={1000}
              action={submit}
              pending={pending}
              blockedReason={canCancel ? null : cancellationClosedReason}
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
              withEvidence
            />
          </div>
        </details>
      ) : null}

      {activeDispute ? (
        <>
          <p className="muted">Mevcut uyuşmazlık sonuçlanana kadar yeni bir kayıt açılamaz.</p>
          {activeDisputeRecord ? (
            <EvidenceForm
              disputeId={activeDisputeRecord.id}
              action={submit}
              pending={pending}
            />
          ) : null}
        </>
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
  blockedReason = null,
  withEvidence = false,
}: {
  operation: "cancel" | "dispute";
  label: string;
  button: string;
  maxLength: number;
  action: (formData: FormData) => void;
  pending: boolean;
  /** Eylem kapalıysa nedeni; açıkken `null`. Kapalı form gizlenmiyor. */
  blockedReason?: string | null;
  withEvidence?: boolean;
}) {
  const id = `employer-${operation}-reason`;
  const blocked = blockedReason !== null;
  return (
    <form className="form compact-form" action={action}>
      <input type="hidden" name="operation" value={operation} />
      <div className="field">
        <label htmlFor={id}>{label}</label>
        <textarea id={id} name="reason" required maxLength={maxLength} rows={4} disabled={blocked} />
      </div>
      {withEvidence ? (
        <DisputeEvidenceFields id="employer-dispute-evidence" label="Kanıt dosyaları (isteğe bağlı)" />
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

function EvidenceForm({
  disputeId,
  action,
  pending,
}: {
  disputeId: string;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form className="form compact-form" action={action}>
      <input type="hidden" name="operation" value="evidence" />
      <input type="hidden" name="disputeId" value={disputeId} />
      <DisputeEvidenceFields id={`employer-evidence-${disputeId}`} label="Yeni kanıt dosyaları" required />
      <button className="button button-secondary button-small" disabled={pending}>
        Kanıtları yükle
      </button>
    </form>
  );
}

/**
 * `cancellableNow: false` iken kullanıcının okuduğu neden.
 *
 * Sunucu bu bayrağı üç koşuldan biriyle düşürüyor
 * (`CancellationManager.java:138-140`): durum artık iptal edilebilir kümede
 * değil, atamanın zaten bir iptal kaydı var, ya da açık bir uyuşmazlık var.
 * Üçüncüsü ekranda kendi şeridini taşıyor ve o blok zaten çizilmiyor; geriye
 * kalan ikisi de aynı şeyi söylüyor — sunucudaki atama ekrandakinden yeni.
 */
const cancellationClosedReason =
  "Sunucu bu atamayı şu anda iptal edilebilir saymıyor: iptal edilmiş ya da durumu bu sırada değişmiş olabilir. Sayfayı yenileyip güncel durumu gör.";

function resolutionErrorMessage(errorCode: string, httpStatus: number): string {
  return assignmentErrorMessage(errorCode, httpStatus, resolutionSentences);
}

const resolutionSentences: Readonly<Record<string, string>> = {
  VALIDATION_FAILED: "Geçerli bir gerekçe yazın.",
  CANCELLATION_ALREADY_CANCELLED: "Bu atama zaten iptal edildi.",
  DISPUTE_ALREADY_OPEN: "Bu atamada zaten açık bir uyuşmazlık var.",
};
