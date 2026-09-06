import Link from "next/link";

import { assignmentStatusLabel, formatAssignmentDate } from "@/components/assignment-presenters";
import type { EmployerAssignmentPage } from "@/payments/contract";

import { PaymentStatusBadge } from "./employer-payment";

export function EmployerAssignmentList({
  assignments,
}: {
  assignments: EmployerAssignmentPage;
}) {
  return (
    <div className="assignment-list">
      <div className="assignment-grid">
        {assignments.content.map((assignment) => (
          <article key={assignment.id} className="assignment-card">
            <div className="assignment-card-topline">
              <span className={`assignment-status assignment-status-${assignment.status.toLowerCase()}`}>
                {assignmentStatusLabel[assignment.status]}
              </span>
              <PaymentStatusBadge status={assignment.paymentStatus} />
            </div>
            <div>
              <h2>{assignment.title}</h2>
              <p className="assignment-company">{assignment.workerName || "İşçi bilgisi bekleniyor"}</p>
              {assignment.position ? <p className="assignment-role">{assignment.position}</p> : null}
            </div>
            <dl className="assignment-facts">
              <div>
                <dt>Tarih</dt>
                <dd>{formatAssignmentDate(assignment.startsAt, assignment.endsAt)}</dd>
              </div>
              <div>
                <dt>Konum</dt>
                <dd>{[assignment.districtName, assignment.cityName].filter(Boolean).join(", ") || "Bekleniyor"}</dd>
              </div>
            </dl>
            <Link className="button button-secondary" href={`/isveren/atama/${encodeURIComponent(assignment.id)}`}>
              Atamayı aç
            </Link>
          </article>
        ))}
      </div>
      {assignments.totalPages > 1 ? (
        <nav className="assignment-pagination" aria-label="Atama sayfaları">
          {assignments.first ? <span /> : (
            <Link href={`/isveren/atamalar?sayfa=${assignments.page}`}>Önceki</Link>
          )}
          <span>{`${assignments.page + 1} / ${assignments.totalPages}`}</span>
          {assignments.last ? <span /> : (
            <Link href={`/isveren/atamalar?sayfa=${assignments.page + 2}`}>Sonraki</Link>
          )}
        </nav>
      ) : null}
    </div>
  );
}
