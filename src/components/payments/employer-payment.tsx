import Link from "next/link";

import type { PaymentStatus } from "@/assignments/contract";
import { GateAdvisories, GateBlocks } from "@/components/employer-gate";
import { formatRate } from "@/components/work-detail/presenters";
import { formatDateTime, isFormattableDate } from "@/lib/dates";
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
import { StatusBadge, paymentToneToStatusTone } from "@/components/ui";

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
        <dd>{formatRate(pricing.serviceFeeRate)}</dd>
      </div>
      <div className="payment-breakdown-total">
        <dt>İşveren toplamı</dt>
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
    <StatusBadge className="payment-status" tone={paymentToneToStatusTone(presentation.tone)}>
      {presentation.label}
    </StatusBadge>
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
            <StatusBadge
              className="payment-attempt-status"
              tone={paymentToneToStatusTone(paymentAttemptPresentation(attempt.status).tone)}
            >
              {paymentAttemptLabel(attempt.status)}
            </StatusBadge>
          </div>
          <dl className="payment-attempt-facts">
            {/*
              Kısa referans: destek yazışmasında denemeyi adlandırmanın yolu.
              UUID'nin ilk sekiz karakteri; tamamı ekranda okunmuyor, ama
              `title` ile duruyor ki kopyalanabilsin.
            */}
            {attemptReference(attempt.id) ? (
              <div>
                <dt>Referans</dt>
                <dd><code title={attempt.id}>{attemptReference(attempt.id)}</code></dd>
              </div>
            ) : null}
            <div>
              <dt>Çalışan ücreti</dt>
              <dd>{formatMoney(attempt.workerPayout, attempt.currency)}</dd>
            </div>
            <div>
              <dt>Hizmet bedeli</dt>
              <dd>{formatMoney(attempt.serviceFeeAmount, attempt.currency)}</dd>
            </div>
            {attempt.serviceFeeRate ? (
              <div>
                <dt>Hizmet bedeli oranı</dt>
                <dd>{formatRate(attempt.serviceFeeRate)}</dd>
              </div>
            ) : null}
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
    return "Bu atama için iade süreci başlatıldı.";
  }
  return "Ödeme durumu doğrulanmadan yeni bir ödeme başlatılamaz.";
}

/** UUID'nin ilk sekiz karakteri; kimliği olmayan denemede `null`. */
function attemptReference(id: string): string | null {
  const trimmed = id.trim();
  return trimmed ? trimmed.slice(0, 8) : null;
}

/**
 * Bu ekranda ham değer gösterilmiyor: kullanıcı bir ödemenin ne zaman
 * alındığını okuyor ve ayrıştırılamayan bir dize ona hiçbir şey söylemez.
 */
function formatPaymentDate(value: string): string {
  return isFormattableDate(value) ? formatDateTime(value) : "Tarih bilgisi bekleniyor";
}
