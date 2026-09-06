import Link from "next/link";

import type { PaymentStatus } from "@/assignments/contract";
import { GateAdvisories, GateBlocks } from "@/components/employer-gate";
import type { PricingBreakdown } from "@/lib/job-posting";
import { formatMoney } from "@/lib/money";
import {
  canStartPayment,
  paymentAttemptLabel,
  paymentAttemptPresentation,
  paymentResultPresentation,
  paymentStatusLabel,
  paymentStatusPresentation,
} from "@/payments/checkout";
import type {
  EmployerAssignment,
  PaymentAttempt,
  PaymentResolution,
} from "@/payments/contract";
import type { GateRequirements } from "@/server/session/gates";

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

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const presentation = paymentStatusPresentation(status);
  return (
    <span className={`payment-status payment-status-${presentation.tone}`}>
      {presentation.label}
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
  requirements,
}: {
  assignment: EmployerAssignment;
  requirements: GateRequirements;
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
        <EmployerPaymentGate requirements={requirements} action="Ödemeye geç">
          <Link className="button" href={`/isveren/atama/${encodeURIComponent(assignment.id)}/odeme`}>
            Ödemeye geç
          </Link>
        </EmployerPaymentGate>
      )}

      <Link className="text-link" href={`/isveren/atama/${encodeURIComponent(assignment.id)}/odemeler`}>
        Ödeme denemelerini gör
      </Link>
    </section>
  );
}

export function EmployerPaymentGate({
  requirements,
  action,
  children,
}: {
  requirements: GateRequirements;
  action: string;
  children: React.ReactNode;
}) {
  if (requirements.advisories.length === 0 && requirements.blocked.length === 0) {
    return <>{children}</>;
  }
  return (
    <div className="gate-action">
      <button type="button" className="button button-secondary" disabled>{action}</button>
      <GateAdvisories gates={requirements.advisories} />
      <GateBlocks gates={requirements.blocked} />
    </div>
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
            <span className={`payment-attempt-status payment-attempt-status-${paymentAttemptPresentation(attempt.status).tone}`}>
              {paymentAttemptLabel(attempt.status)}
            </span>
          </div>
          <dl className="payment-attempt-facts">
            <div>
              <dt>Çalışan ücreti</dt>
              <dd>{formatMoney(attempt.workerPayout, attempt.currency)}</dd>
            </div>
            <div>
              <dt>Hizmet bedeli</dt>
              <dd>{formatMoney(attempt.serviceFeeAmount, attempt.currency)}</dd>
            </div>
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
          {attempt.failureMessage || attempt.status === "FAILED" ? (
            <p className="payment-failure-note">
              {attempt.failureMessage ||
                "Ödeme alınmadı. Kartını ve banka doğrulamasını kontrol edip yeniden deneyebilirsin."}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function PaymentResultNotice({ resolution }: { resolution: PaymentResolution }) {
  const presentation = paymentResultPresentation(resolution);
  return (
    <div
      role={presentation.role}
      className={`payment-result-notice payment-result-${presentation.tone}`}
    >
      <h2>{presentation.title}</h2>
      <p>{presentation.body}</p>
    </div>
  );
}

export function DisputeEscrowNotice({ hasActiveDispute }: { hasActiveDispute: boolean }) {
  if (!hasActiveDispute) return null;
  return (
    <p role="status" className="escrow-note dispute-escrow-note">
      Bu atamada açık bir uyuşmazlık var. İnceleme sonuçlanana kadar emanetten çıkış bekler.
    </p>
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
