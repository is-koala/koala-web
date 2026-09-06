import type {
  AssignmentDispute,
  AssignmentResolution,
  CancellationRecord,
  RefundStatus,
} from "@/assignments/resolution";
import { formatMoney } from "@/lib/money";

export function AssignmentResolutionPanel({
  resolution,
  currency,
}: {
  resolution: AssignmentResolution;
  currency: string;
}) {
  const hasRecords = resolution.cancellation !== null || resolution.disputes.length > 0;
  const activeDispute = resolution.disputes.some(
    (dispute) => dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW",
  );

  return (
    <section className="assignment-resolution" aria-labelledby="assignment-resolution-title">
      <h2 id="assignment-resolution-title">İptal, iade ve uyuşmazlık</h2>

      {activeDispute ? (
        <p role="status" className="escrow-note dispute-escrow-note">
          Bu atamada açık bir uyuşmazlık var. İnceleme sonuçlanana kadar emanetteki
          para donduruldu; işçiye aktarılmaz veya iade edilmez.
        </p>
      ) : null}

      {!hasRecords ? (
        <div className="state-card assignment-resolution-empty">
          <h3>Henüz iptal veya uyuşmazlık kaydı yok</h3>
          <p>Bu atamayla ilgili sonuçlandırma hareketleri burada görünecek.</p>
        </div>
      ) : null}

      {resolution.cancellation ? (
        <CancellationSummary cancellation={resolution.cancellation} currency={currency} />
      ) : null}

      {resolution.disputes.length > 0 ? (
        <ol className="assignment-resolution-list" aria-label="Uyuşmazlık geçmişi">
          {resolution.disputes.map((dispute) => (
            <DisputeSummary key={dispute.id} dispute={dispute} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function CancellationSummary({
  cancellation,
  currency,
}: {
  cancellation: CancellationRecord;
  currency: string;
}) {
  return (
    <article className="assignment-resolution-card">
      <div className="assignment-resolution-heading">
        <div>
          <p className="eyebrow">Atama iptali</p>
          <h3>{refundLabel(cancellation.refundStatus)}</h3>
        </div>
        <span className="payment-status payment-status-neutral">
          {cancellation.cancelledByParty === "EMPLOYER"
            ? "İşveren iptal etti"
            : cancellation.cancelledByParty === "WORKER"
              ? "İşçi çekildi"
              : "Atama iptal edildi"}
        </span>
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
          <dd><time dateTime={cancellation.cancelledAt}>{formatDate(cancellation.cancelledAt)}</time></dd>
        </div>
        <div>
          <dt>İade tamamlanma</dt>
          <dd>{cancellation.refundCompletedAt
            ? <time dateTime={cancellation.refundCompletedAt}>{formatDate(cancellation.refundCompletedAt)}</time>
            : "Henüz tamamlanmadı"}</dd>
        </div>
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
        <time dateTime={dispute.createdAt}>{formatDate(dispute.createdAt)}</time>
      </div>
      <p>{dispute.reason}</p>
      {dispute.resolution ? (
        <p><strong>Karar:</strong> {disputeResolutionLabel(dispute.resolution)}</p>
      ) : null}
      {dispute.resolutionNote ? <p>{dispute.resolutionNote}</p> : null}
    </li>
  );
}

function refundLabel(status: RefundStatus | null): string {
  switch (status) {
    case null:
      return "İade talebi alındı";
    case "PENDING":
      return "İade işleniyor";
    case "COMPLETED":
      return "İade edildi";
    case "FAILED":
      return "İade tamamlanamadı";
    default:
      return "İade durumu bekleniyor";
  }
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(date);
}
