"use client";

import Link from "next/link";

import type { WorkerAssignment } from "@/assignments/contract";
import {
  assignmentStatusLabel,
  formatAssignmentDate,
  formatMoney,
  paymentStatusLabel,
} from "@/components/assignment-presenters";

export function AssignmentCard({
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
      ) : assignment.status !== "REJECTED" ? (
        <div className="assignment-actions">
          <Link
            className="button button-secondary button-small"
            href={`/panel/is/${assignment.id}`}
          >
            İş ayrıntısını aç
          </Link>
        </div>
      ) : null}
    </article>
  );
}
