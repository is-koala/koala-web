"use client";

import Link from "next/link";

import type { WorkerAssignment } from "@/assignments/contract";
import {
  assignmentStatusLabel,
  formatAssignmentDate,
  formatMoney,
  paymentStatusLabel,
} from "@/components/assignment-presenters";
import { StatusBadge, assignmentStatusTone, paymentStatusTone } from "@/components/ui";
import { employerTypeLabel } from "@/jobs/employer-jobs";
import { formatDateTime } from "@/lib/dates";

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
  // Bireysel ilanda `companyName` boş: kart işverenin kim olduğunu ancak bu
  // rozetle söyleyebiliyor. Şirket ilanında ad zaten yazıyor, rozet gereksiz.
  const employerBadge = assignment.employerType === "INDIVIDUAL"
    ? employerTypeLabel(assignment.employerType)
    : null;

  return (
    <article
      className={`assignment-card${
        assignment.status === "PENDING_CONFIRMATION" ? " assignment-card-pending" : ""
      }`}
    >
      <div className="assignment-card-topline">
        <StatusBadge tone={assignmentStatusTone(assignment.status)}>
          {assignmentStatusLabel[assignment.status]}
        </StatusBadge>
        <StatusBadge tone={paymentStatusTone(assignment.paymentStatus)}>
          {paymentStatusLabel[assignment.paymentStatus]}
        </StatusBadge>
        {employerBadge ? <StatusBadge tone="neutral">{employerBadge}</StatusBadge> : null}
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
        {assignment.assignedAt ? (
          <div>
            <dt>Teklif</dt>
            <dd>
              <time dateTime={assignment.assignedAt}>{formatDateTime(assignment.assignedAt)}</time>
            </dd>
          </div>
        ) : null}
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
