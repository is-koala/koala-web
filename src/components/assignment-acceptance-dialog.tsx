"use client";

import type { WorkerAssignment } from "@/assignments/contract";
import { formatAssignmentDate, formatMoney } from "@/components/assignment-presenters";

export function AssignmentAcceptanceDialog({
  acceptance,
  currentPage,
  formAction,
  isPending,
  onClose,
}: {
  acceptance: { assignment: WorkerAssignment; fullAddress: string };
  currentPage: number;
  formAction: (payload: FormData) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  return (
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
              {formatAssignmentDate(acceptance.assignment.startsAt, acceptance.assignment.endsAt)}
            </dd>
          </div>
          <div>
            <dt>Kazanç</dt>
            <dd>{formatMoney(acceptance.assignment.workerPayout, acceptance.assignment.currency)}</dd>
          </div>
          <div>
            <dt>Tam adres</dt>
            <dd>{acceptance.fullAddress}</dd>
          </div>
        </dl>
        <div className="assignment-dialog-actions">
          <form action={formAction} onSubmit={onClose}>
            <input type="hidden" name="assignmentId" value={acceptance.assignment.id} />
            <input type="hidden" name="currentPage" value={currentPage} />
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
            onClick={onClose}
            disabled={isPending}
          >
            Vazgeç
          </button>
        </div>
      </section>
    </div>
  );
}
