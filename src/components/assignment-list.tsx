"use client";

import { useActionState, useState, useTransition } from "react";

import {
  type AssignmentAcceptanceAction,
  idleAssignmentResponseState,
  type AssignmentResponseAction,
  type AssignmentStatus,
  type PaymentStatus,
  type WorkerAssignment,
  type WorkerAssignmentPage,
} from "@/assignments/contract";
import { EmptyState, ErrorState } from "@/components/states";

export function AssignmentList({
  initialPage,
  respondAction,
  acceptanceAction,
}: {
  initialPage: WorkerAssignmentPage;
  respondAction: AssignmentResponseAction;
  acceptanceAction: AssignmentAcceptanceAction;
}) {
  const [state, formAction, isPending] = useActionState(
    respondAction,
    idleAssignmentResponseState,
  );
  const [acceptance, setAcceptance] = useState<{
    assignment: WorkerAssignment;
    fullAddress: string;
  } | null>(null);
  const [acceptanceFailure, setAcceptanceFailure] = useState<{
    errorCode: string;
    httpStatus: number;
  } | null>(null);
  const [isAcceptancePending, startAcceptanceTransition] = useTransition();
  const page = state.status === "idle" ? initialPage : (state.assignments ?? initialPage);
  const awaitingResponse = page.content.filter(
    (assignment) => assignment.status === "PENDING_CONFIRMATION",
  );
  const answered = page.content.filter(
    (assignment) => assignment.status !== "PENDING_CONFIRMATION",
  );

  function prepareAcceptance(assignment: WorkerAssignment) {
    setAcceptanceFailure(null);
    startAcceptanceTransition(async () => {
      const result = await acceptanceAction(assignment.id, assignment.jobId);
      if (result.status === "done") {
        setAcceptance({ assignment, fullAddress: result.fullAddress });
      } else {
        setAcceptanceFailure(result);
      }
    });
  }

  return (
    <div className="assignment-list" aria-busy={isPending}>
      {state.status === "error" ? (
        <ErrorState errorCode={state.errorCode} status={state.httpStatus} />
      ) : null}
      {acceptanceFailure ? (
        <ErrorState
          errorCode={acceptanceFailure.errorCode}
          status={acceptanceFailure.httpStatus}
        />
      ) : null}

      {page.content.length === 0 ? <EmptyState kind="assignments" /> : null}

      {awaitingResponse.length > 0 ? (
        <section
          className="assignment-section assignment-section-pending"
          aria-labelledby="pending-assignments-heading"
        >
          <div className="assignment-section-heading">
            <p className="eyebrow">Yanıtın gerekiyor</p>
            <h2 id="pending-assignments-heading">Onayını bekleyen işler</h2>
          </div>
          <div className="assignment-grid">
            {awaitingResponse.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                formAction={formAction}
                currentPage={page.page}
                disabled={isPending || isAcceptancePending}
                onPrepareAcceptance={prepareAcceptance}
              />
            ))}
          </div>
        </section>
      ) : null}

      {answered.length > 0 ? (
        <section className="assignment-section" aria-labelledby="answered-assignments-heading">
          <div className="assignment-section-heading">
            <p className="eyebrow">Güncel durum</p>
            <h2 id="answered-assignments-heading">
              {awaitingResponse.length > 0 ? "Diğer atamalar" : "Atamalar"}
            </h2>
          </div>
          <div className="assignment-grid">
            {answered.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                formAction={formAction}
                currentPage={page.page}
                disabled={isPending || isAcceptancePending}
                onPrepareAcceptance={prepareAcceptance}
              />
            ))}
          </div>
        </section>
      ) : null}

      {page.totalPages > 1 || page.page > 0 ? (
        <nav className="assignment-pagination" aria-label="Atama sayfaları">
          <form action={formAction}>
            <input type="hidden" name="decision" value="page" />
            <input type="hidden" name="targetPage" value={Math.max(0, page.page - 1)} />
            <button className="button button-secondary button-small" disabled={page.first || isPending}>
              Önceki sayfa
            </button>
          </form>
          <span>
            Sayfa {page.page + 1} / {Math.max(page.totalPages, 1)}
          </span>
          <form action={formAction}>
            <input type="hidden" name="decision" value="page" />
            <input type="hidden" name="targetPage" value={page.page + 1} />
            <button className="button button-secondary button-small" disabled={page.last || isPending}>
              Sonraki sayfa
            </button>
          </form>
        </nav>
      ) : null}

      {acceptance ? (
        <div
          className="assignment-dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-dialog-title"
        >
          <section className="assignment-dialog">
            <p className="eyebrow">Son kontrol</p>
            <h2 id="assignment-dialog-title">İşi kabul et</h2>
            <h3>{acceptance.assignment.title}</h3>
            <dl className="assignment-dialog-facts">
              <div>
                <dt>Tarih</dt>
                <dd>
                  {formatAssignmentDate(
                    acceptance.assignment.startsAt,
                    acceptance.assignment.endsAt,
                  )}
                </dd>
              </div>
              <div>
                <dt>Kazanç</dt>
                <dd>
                  {formatMoney(
                    acceptance.assignment.workerPayout,
                    acceptance.assignment.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt>Tam adres</dt>
                <dd>{acceptance.fullAddress}</dd>
              </div>
            </dl>
            <div className="assignment-dialog-actions">
              <form action={formAction} onSubmit={() => setAcceptance(null)}>
                <input type="hidden" name="assignmentId" value={acceptance.assignment.id} />
                <input type="hidden" name="currentPage" value={page.page} />
                <button
                  className="button button-primary button-small"
                  type="submit"
                  name="decision"
                  value="accept"
                  disabled={isPending}
                >
                  {isPending ? "Yanıt gönderiliyor" : "Kabulü onayla"}
                </button>
              </form>
              <button
                className="button button-secondary button-small"
                type="button"
                onClick={() => setAcceptance(null)}
                disabled={isPending}
              >
                Vazgeç
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function AssignmentCard({
  assignment,
  formAction,
  currentPage,
  disabled,
  onPrepareAcceptance,
}: {
  assignment: WorkerAssignment;
  formAction: (payload: FormData) => void;
  currentPage: number;
  disabled: boolean;
  onPrepareAcceptance: (assignment: WorkerAssignment) => void;
}) {
  const location = [assignment.districtName, assignment.cityName].filter(Boolean).join(", ");

  return (
    <article
      className={`assignment-card${
        assignment.status === "PENDING_CONFIRMATION" ? " assignment-card-pending" : ""
      }`}
    >
      <div className="assignment-card-topline">
        <span className={`assignment-status assignment-status-${assignment.status.toLowerCase()}`}>
          {assignmentStatusLabel[assignment.status]}
        </span>
        <span className="assignment-payment">{paymentStatusLabel[assignment.paymentStatus]}</span>
      </div>

      <div>
        <h3>{assignment.title}</h3>
        {assignment.companyName ? <p className="assignment-company">{assignment.companyName}</p> : null}
        {assignment.position || assignment.categoryName ? (
          <p className="assignment-role">
            {[assignment.position, assignment.categoryName].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      <dl className="assignment-facts">
        <div>
          <dt>Tarih</dt>
          <dd>{formatAssignmentDate(assignment.startsAt, assignment.endsAt)}</dd>
        </div>
        {location ? (
          <div>
            <dt>Konum</dt>
            <dd>{location}</dd>
          </div>
        ) : null}
        <div>
          <dt>Kazanç</dt>
          <dd>{formatMoney(assignment.workerPayout, assignment.currency)}</dd>
        </div>
      </dl>

      {assignment.status === "CONFIRMED" &&
      assignment.paymentStatus === "PENDING_COLLECTION" ? (
        <p className="assignment-notice">İşverenin ödemesi bekleniyor.</p>
      ) : null}

      {assignment.status === "PENDING_CONFIRMATION" ? (
        <div className="assignment-actions">
          <button
            className="button button-primary button-small"
            type="button"
            onClick={() => onPrepareAcceptance(assignment)}
            disabled={disabled}
          >
            {disabled ? "Hazırlanıyor" : "Kabul et"}
          </button>
          <form action={formAction}>
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <input type="hidden" name="currentPage" value={currentPage} />
            <button
              className="button button-secondary button-small"
              type="submit"
              name="decision"
              value="reject"
              disabled={disabled}
            >
              Reddet
            </button>
          </form>
        </div>
      ) : null}
    </article>
  );
}

const assignmentStatusLabel: Record<AssignmentStatus, string> = {
  PENDING_CONFIRMATION: "Onay bekliyor",
  CONFIRMED: "Onaylandı",
  IN_PROGRESS: "Devam ediyor",
  COMPLETED: "Tamamlandı",
  REJECTED: "Reddedildi",
  CANCELLED: "İptal edildi",
  UNKNOWN: "Durum güncelleniyor",
};

const paymentStatusLabel: Record<PaymentStatus, string> = {
  PENDING_COLLECTION: "Ödeme bekleniyor",
  HELD_IN_ESCROW: "Ödeme güvende",
  RELEASED_TO_WORKER: "Ödeme aktarıldı",
  FAILED: "Ödeme tamamlanamadı",
  REFUNDED: "Ödeme iade edildi",
  UNKNOWN: "Ödeme durumu güncelleniyor",
};

const monthNames = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

function formatAssignmentDate(startsAt: string, endsAt: string): string {
  const start = localDateParts(startsAt);
  const end = localDateParts(endsAt);
  if (!start || !end) return startsAt;

  const startLabel = `${start.day} ${monthNames[start.month - 1]} ${start.year}, ${start.time}`;
  if (start.year === end.year && start.month === end.month && start.day === end.day) {
    return `${startLabel}–${end.time}`;
  }
  return `${startLabel} – ${end.day} ${monthNames[end.month - 1]} ${end.year}, ${end.time}`;
}

function localDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    time: `${match[4]}:${match[5]}`,
  };
}

function formatMoney(amount: string, currency: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value) || !currency) return [amount, currency].filter(Boolean).join(" ");
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(value);
  } catch {
    return `${amount} ${currency}`;
  }
}
