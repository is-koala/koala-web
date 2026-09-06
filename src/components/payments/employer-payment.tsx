import Link from "next/link";

import { EmployerGate } from "@/components/employer-gate";
import type { PricingBreakdown } from "@/lib/job-posting";
import type { GateId } from "@/lib/gates";
import { formatMoney } from "@/lib/money";
import {
  canStartPayment,
  paymentAttemptLabel,
  paymentStatusLabel,
} from "@/payments/checkout";
import type {
  EmployerAssignment,
  PaymentAttempt,
  PaymentResolution,
} from "@/payments/contract";

export function PaymentBreakdown({ pricing }: { pricing: PricingBreakdown }) {
  return (
    <dl className="payment-breakdown">
      <div>
        <dt>Çalışan ücreti</dt>
        <dd>{formatMoney(pricing.workerPayout, pricing.currency)}</dd>
      </div>
      <div>
        <dt>Koala hizmet bedeli</dt>
        <dd>{formatMoney(pricing.serviceFeeAmount, pricing.currency)}</dd>
      </div>
      <div>
        <dt>Hizmet bedeli oranı</dt>
        <dd>{pricing.serviceFeeRate}</dd>
      </div>
      <div className="payment-breakdown-total">
        <dt>Ödeyeceğin toplam</dt>
        <dd>{formatMoney(pricing.employerTotal, pricing.currency)}</dd>
      </div>
      <div>
        <dt>Fiyat sürümü</dt>
        <dd>{pricing.pricingVersion}</dd>
      </div>
    </dl>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <span className={`payment-status payment-status-${status.toLowerCase()}`}>
      {paymentStatusLabel(status)}
    </span>
  );
}

export function EscrowExplanation() {
  return (
    <p className="escrow-note">
      Ödediğin para iş tamamlanana kadar Koala&apos;da emanette tutulur, ardından işçiye
      aktarılır.
    </p>
  );
}

export function EmployerAssignmentPayment({
  assignment,
  blocked,
}: {
  assignment: EmployerAssignment;
  blocked: readonly GateId[];
}) {
  const eligible = canStartPayment(assignment);

  return (
    <section className="payment-action-card" aria-labelledby="payment-action-title">
      <div className="payment-action-heading">
        <div>
          <p className="eyebrow">Ödeme durumu</p>
          <h2 id="payment-action-title">{paymentStatusLabel(assignment.paymentStatus)}</h2>
        </div>
        <PaymentStatusBadge status={assignment.paymentStatus} />
      </div>
      <EscrowExplanation />

      {!eligible ? (
        <div className="payment-disabled-reason">
          <button type="button" className="button button-secondary" disabled>
            Ödemeye geç
          </button>
          <p>{paymentDisabledReason(assignment)}</p>
        </div>
      ) : (
        <EmployerGate blocked={blocked} action="Ödemeye geç">
          <Link className="button" href={`/isveren/atama/${encodeURIComponent(assignment.id)}/odeme`}>
            Ödemeye geç
          </Link>
        </EmployerGate>
      )}

      <Link className="text-link" href={`/isveren/atama/${encodeURIComponent(assignment.id)}/odemeler`}>
        Ödeme denemelerini gör
      </Link>
    </section>
  );
}

export function PaymentHistory({ attempts }: { attempts: readonly PaymentAttempt[] }) {
  if (attempts.length === 0) {
    return (
      <div role="status" className="state-card">
        <h2>Henüz ödeme denemesi yok</h2>
        <p>Başlattığın her ödeme denemesi burada ayrı bir kayıt olarak görünecek.</p>
      </div>
    );
  }

  return (
    <ol className="payment-attempt-list">
      {attempts.map((attempt, index) => (
        <li key={attempt.id} className="payment-attempt-card">
          <div className="payment-attempt-heading">
            <div>
              <p className="eyebrow">Ödeme denemesi</p>
              <h2>{`${attempts.length - index}. deneme`}</h2>
            </div>
            <span className={`payment-attempt-status payment-attempt-status-${attempt.status.toLowerCase()}`}>
              {paymentAttemptLabel(attempt.status)}
            </span>
          </div>
          <dl className="payment-attempt-facts">
            <div>
              <dt>Toplam</dt>
              <dd>{formatMoney(attempt.employerTotal, attempt.currency)}</dd>
            </div>
            <div>
              <dt>Başlatılma</dt>
              <dd><time dateTime={attempt.createdAt}>{formatPaymentDate(attempt.createdAt)}</time></dd>
            </div>
            <div>
              <dt>Tamamlanma</dt>
              <dd>{attempt.completedAt
                ? <time dateTime={attempt.completedAt}>{formatPaymentDate(attempt.completedAt)}</time>
                : "Henüz tamamlanmadı"}</dd>
            </div>
          </dl>
          {attempt.status === "FAILED" ? (
            <p className="payment-failure-note">
              Ödeme alınmadı. Kartını ve banka doğrulamasını kontrol edip yeniden deneyebilirsin.
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function PaymentResultNotice({ resolution }: { resolution: PaymentResolution }) {
  if (resolution === "succeeded") {
    return (
      <div role="status" className="payment-result-notice payment-result-success">
        <h2>Ödeme doğrulandı</h2>
        <p>Ödediğin tutar Koala&apos;da emanete alındı.</p>
      </div>
    );
  }
  if (resolution === "failed") {
    return (
      <div role="alert" className="payment-result-notice payment-result-failed">
        <h2>Ödeme tamamlanamadı</h2>
        <p>Ödeme alınmadı. Atamanın koşulları uygunsa yeniden deneyebilirsin.</p>
      </div>
    );
  }
  return (
    <div role="status" className="payment-result-notice">
      <h2>Ödeme sonucunu bekliyoruz</h2>
      <p>Sonuç kesinleşene kadar yeni bir ödeme başlatma.</p>
    </div>
  );
}

function paymentDisabledReason(assignment: EmployerAssignment): string {
  if (assignment.status !== "CONFIRMED") {
    return "Ödeme için önce işçinin atamayı onaylaması gerekiyor.";
  }
  if (assignment.paymentStatus === "HELD_IN_ESCROW") {
    return "Bu atamanın ücreti tahsil edildi ve emanette tutuluyor.";
  }
  if (assignment.paymentStatus === "RELEASED_TO_WORKER") {
    return "Bu atamanın ücreti işçiye aktarıldı.";
  }
  if (assignment.paymentStatus === "REFUNDED") {
    return "Bu atamanın ödemesi iade edildi.";
  }
  return "Ödeme durumu doğrulanmadan yeni bir ödeme başlatılamaz.";
}

function formatPaymentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tarih bilgisi bekleniyor";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(date);
}
