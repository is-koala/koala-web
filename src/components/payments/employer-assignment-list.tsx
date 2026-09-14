import Link from "next/link";

import { assignmentNextStep } from "@/assignments/employer-tracking";
import { assignmentStatusLabel, formatAssignmentDate } from "@/components/assignment-presenters";
import { StatusBadge, assignmentStatusTone } from "@/components/ui";
import { formatMoney } from "@/lib/money";
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
              <StatusBadge tone={assignmentStatusTone(assignment.status)}>
                {assignmentStatusLabel[assignment.status]}
              </StatusBadge>
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
              {/*
                Sıfır saat "henüz çalışılmadı" demek; sayı olarak yazmak
                çalışıldığını ama kaydın boş olduğunu sandırırdı.
              */}
              {assignment.workHours > 0 ? (
                <div>
                  <dt>Çalışılan saat</dt>
                  <dd>{`${assignment.workHours} saat`}</dd>
                </div>
              ) : null}
              {assignment.pricing ? (
                <div>
                  <dt>İşveren toplamı</dt>
                  <dd>{formatMoney(assignment.pricing.employerTotal, assignment.pricing.currency)}</dd>
                </div>
              ) : null}
            </dl>
            {/*
              Rozet `PENDING_CONFIRMATION` ile `CONFIRMED` arasındaki farkı
              gösteriyor; bu satır o farkın **ne anlama geldiğini** yazıyor.
              Ödeme yalnız `CONFIRMED` iken açılabiliyor, yani iki satırda
              kullanıcının yapacağı iş farklı.
            */}
            <p className="assignment-notice">
              {assignmentNextStep(assignment.status, assignment.paymentStatus)}
            </p>
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
