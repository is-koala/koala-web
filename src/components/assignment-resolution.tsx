import {
  hasActiveDispute,
  type AssignmentDispute,
  type AssignmentResolution,
  type CancellationRecord,
  type RefundStatus,
  type WorkerAssignmentResolution,
} from "@/assignments/resolution";
import { formatDateTime } from "@/lib/dates";
import { errorPresentation } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/ui";

import { EvidenceDownloadButton } from "./evidence-download-button";
import { EvidenceRetryButton } from "./evidence-retry-button";

export function AssignmentResolutionPanel({
  resolution,
  currency,
}: {
  resolution: AssignmentResolution;
  currency: string;
}) {
  const hasRecords = resolution.cancellation !== null || resolution.disputes.length > 0;
  const activeDispute = hasActiveDispute(resolution);

  return (
    <section className="assignment-resolution" aria-labelledby="assignment-resolution-title">
      <h2 id="assignment-resolution-title">İptal, iade ve uyuşmazlık</h2>

      {activeDispute ? <ActiveDisputeNotice /> : null}

      {!hasRecords ? <EmptyResolution /> : null}

      {resolution.cancellation ? (
        <CancellationSummary cancellation={resolution.cancellation} currency={currency} />
      ) : null}

      {resolution.disputes.length > 0 ? <DisputeList disputes={resolution.disputes} /> : null}
    </section>
  );
}

export function WorkerAssignmentResolutionPanel({
  resolution,
}: {
  resolution: WorkerAssignmentResolution;
}) {
  const hasRecords = resolution.cancellation !== null || resolution.disputes.length > 0;
  const activeDispute = hasActiveDispute(resolution);

  return (
    <section className="assignment-resolution" aria-labelledby="assignment-resolution-title">
      <h2 id="assignment-resolution-title">İptal ve uyuşmazlık</h2>
      {activeDispute ? <ActiveDisputeNotice /> : null}
      {!hasRecords ? <EmptyResolution /> : null}
      {resolution.cancellation ? (
        <WorkerCancellationSummary cancellation={resolution.cancellation} />
      ) : null}
      {resolution.disputes.length > 0 ? <DisputeList disputes={resolution.disputes} /> : null}
    </section>
  );
}

function WorkerCancellationSummary({
  cancellation,
}: {
  cancellation: NonNullable<WorkerAssignmentResolution["cancellation"]>;
}) {
  return (
    <article className="assignment-resolution-card">
      <div className="assignment-resolution-heading">
        <div>
          <p className="eyebrow">Atama iptali</p>
          <h3>Atama sona erdi</h3>
        </div>
        <CancellationPartyLabel party={cancellation.cancelledByParty} />
      </div>
      <p>{cancellation.reason}</p>
      <p>
        <strong>İptal zamanı:</strong>{" "}
        <time dateTime={cancellation.cancelledAt}>{formatDateTime(cancellation.cancelledAt)}</time>
      </p>
    </article>
  );
}

function ActiveDisputeNotice() {
  return (
    <p role="status" className="escrow-note dispute-escrow-note">
      Bu atamada açık bir uyuşmazlık var. İnceleme sonuçlanana kadar emanetteki
      para donduruldu; işçiye aktarılmaz veya iade edilmez.
    </p>
  );
}

function EmptyResolution() {
  return (
    <div className="state-card assignment-resolution-empty">
      <h3>Henüz iptal veya uyuşmazlık kaydı yok</h3>
      <p>Bu atamayla ilgili sonuçlandırma hareketleri burada görünecek.</p>
    </div>
  );
}

function DisputeList({ disputes }: { disputes: readonly AssignmentDispute[] }) {
  return (
    <ol className="assignment-resolution-list" aria-label="Uyuşmazlık geçmişi">
      {disputes.map((dispute) => <DisputeSummary key={dispute.id} dispute={dispute} />)}
    </ol>
  );
}

function CancellationPartyLabel({
  party,
}: {
  party: CancellationRecord["cancelledByParty"];
}) {
  return (
    <StatusBadge tone="neutral">
      {party === "EMPLOYER"
        ? "İşveren iptal etti"
        : party === "WORKER"
          ? "İşçi çekildi"
          : "Atama iptal edildi"}
    </StatusBadge>
  );
}

function CancellationSummary({
  cancellation,
  currency,
}: {
  cancellation: CancellationRecord;
  currency: string;
}) {
  const hasRefund = !isZeroAmount(cancellation.refundAmount);
  return (
    <article className="assignment-resolution-card">
      <div className="assignment-resolution-heading">
        <div>
          <p className="eyebrow">Atama iptali</p>
          <h3>{refundLabel(cancellation.refundStatus, hasRefund)}</h3>
        </div>
        <CancellationPartyLabel party={cancellation.cancelledByParty} />
      </div>
      <p>{cancellation.reason}</p>
      <dl className="cancellation-facts">
        <div>
          <dt>İade tutarı</dt>
          <dd>{formatMoney(cancellation.refundAmount, currency)}</dd>
        </div>
        <div>
          <dt>İptal kesintisi</dt>
          <dd>{formatMoney(cancellation.feeAmount, currency)}</dd>
        </div>
        <div>
          <dt>İptal zamanı</dt>
          <dd><time dateTime={cancellation.cancelledAt}>{formatDateTime(cancellation.cancelledAt)}</time></dd>
        </div>
        {hasRefund ? (
          <div>
            <dt>İade tamamlanma</dt>
            <dd>{cancellation.refundCompletedAt
              ? <time dateTime={cancellation.refundCompletedAt}>{formatDateTime(cancellation.refundCompletedAt)}</time>
              : "Henüz tamamlanmadı"}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

function DisputeSummary({ dispute }: { dispute: AssignmentDispute }) {
  return (
    <li className="assignment-resolution-card">
      <div className="assignment-resolution-heading">
        <div>
          <p className="eyebrow">Uyuşmazlık</p>
          <h3>{disputeStatusLabel(dispute.status)}</h3>
        </div>
        <time dateTime={dispute.createdAt}>{formatDateTime(dispute.createdAt)}</time>
      </div>
      <p>{dispute.reason}</p>
      {dispute.resolution ? (
        <p><strong>Karar:</strong> {disputeResolutionLabel(dispute.resolution)}</p>
      ) : null}
      {dispute.resolutionNote ? <p>{dispute.resolutionNote}</p> : null}
      <DisputeEvidenceList dispute={dispute} />
    </li>
  );
}

function DisputeEvidenceList({ dispute }: { dispute: AssignmentDispute }) {
  if (dispute.evidence.status === "error") {
    const presentation = errorPresentation(
      dispute.evidence.errorCode,
      dispute.evidence.httpStatus,
    );
    return (
      <div className="state-card dispute-evidence-error">
        <p role="alert">{presentation.message} Uyuşmazlık kaydı görünmeye devam ediyor.</p>
        {presentation.action === "retry" ? <EvidenceRetryButton /> : null}
      </div>
    );
  }
  if (dispute.evidence.items.length === 0) {
    return <p className="muted">Henüz kanıt dosyası eklenmedi.</p>;
  }
  return (
    <div className="dispute-evidence">
      <h4>Kanıt dosyaları</h4>
      <ul aria-label="Uyuşmazlık kanıtları">
        {dispute.evidence.items.map((evidence) => (
          <li key={evidence.id}>
            <EvidenceDownloadButton
              href={`/api/disputes/${encodeURIComponent(dispute.id)}/evidence/${encodeURIComponent(evidence.id)}/download`}
              fileName={evidence.fileName}
            />
            <span>
              {evidence.uploadedByName} · {evidenceContentLabel(evidence.contentType)} · {formatFileSize(evidence.fileSize)}
            </span>
            <time dateTime={evidence.createdAt}>{formatDateTime(evidence.createdAt)}</time>
          </li>
        ))}
      </ul>
    </div>
  );
}

function evidenceContentLabel(contentType: string): string {
  switch (contentType) {
    case "application/pdf":
      return "PDF belgesi";
    case "image/png":
      return "PNG görseli";
    case "image/jpeg":
      return "JPG görseli";
    case "image/webp":
      return "WEBP görseli";
    default:
      return "Dosya";
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bayt`;
  if (bytes < 1024 * 1024) return `${formatFileSizeNumber(bytes / 1024)} KB`;
  return `${formatFileSizeNumber(bytes / (1024 * 1024))} MB`;
}

function formatFileSizeNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function refundLabel(status: RefundStatus | null, hasRefund: boolean): string {
  if (!hasRefund) return "İade gerekmiyor";
  switch (status) {
    case null:
      return "İade durumu bekleniyor";
    case "PENDING":
      return "İade talep edildi";
    case "PROCESSING":
      return "İade işleniyor";
    case "COMPLETED":
      return "İade edildi";
    case "FAILED":
      return "İade tamamlanamadı";
    default:
      return "İade durumu bekleniyor";
  }
}

function isZeroAmount(value: string): boolean {
  return /^-?0+(?:\.0+)?$/.test(value.trim());
}

function disputeStatusLabel(status: AssignmentDispute["status"]): string {
  switch (status) {
    case "OPEN":
      return "Kayıt alındı";
    case "UNDER_REVIEW":
      return "İnceleniyor";
    case "RESOLVED":
      return "Sonuçlandı";
    default:
      return "Durum bekleniyor";
  }
}

function disputeResolutionLabel(resolution: NonNullable<AssignmentDispute["resolution"]>): string {
  switch (resolution) {
    case "RELEASE_TO_WORKER":
      return "İşçiye ödeme";
    case "REFUND_EMPLOYER":
      return "İşverene iade";
    case "DISMISSED":
      return "Talep reddedildi";
  }
}
