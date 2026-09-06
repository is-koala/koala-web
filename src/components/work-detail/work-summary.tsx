import type { WorkDetail } from "@/assignments/work-detail";
import {
  assignmentStatusLabel,
  formatAssignmentDate,
  formatMoney,
  paymentStatusLabel,
} from "@/components/assignment-presenters";

export function WorkSummary({ detail }: { detail: WorkDetail }) {
  const { assignment } = detail;
  const location = [assignment.districtName, assignment.cityName].filter(Boolean).join(", ");

  return (
    <section className="work-detail-summary" aria-labelledby="work-summary-heading">
      <div className="assignment-card-topline">
        <span className={`assignment-status assignment-status-${assignment.status.toLowerCase()}`}>
          {assignmentStatusLabel[assignment.status]}
        </span>
        <span className="assignment-payment">{paymentStatusLabel[assignment.paymentStatus]}</span>
      </div>
      <div>
        <p className="eyebrow">Çalışma ayrıntısı</p>
        <h1 id="work-summary-heading">{assignment.title}</h1>
        {assignment.companyName ? <p className="lede">{assignment.companyName}</p> : null}
      </div>
      <dl className="work-detail-facts">
        <div>
          <dt>Tarih ve saat</dt>
          <dd>{formatAssignmentDate(assignment.startsAt, assignment.endsAt)}</dd>
        </div>
        {location ? <div><dt>Bölge</dt><dd>{location}</dd></div> : null}
        <div>
          <dt>Kazanç</dt>
          <dd>{formatMoney(assignment.workerPayout, assignment.currency)}</dd>
        </div>
        {assignment.position || assignment.categoryName ? (
          <div>
            <dt>Görev</dt>
            <dd>{[assignment.position, assignment.categoryName].filter(Boolean).join(" · ")}</dd>
          </div>
        ) : null}
      </dl>

      <div className="work-address">
        <h2>İş adresi</h2>
        {detail.fullAddress ? (
          <address>{detail.fullAddress}</address>
        ) : (
          <p className="muted">Adres işin güncel durumunda paylaşılmıyor.</p>
        )}
      </div>

      {detail.description || detail.duties || detail.dressCode ? (
        <div className="work-brief-grid">
          {detail.description ? <div><h2>İş hakkında</h2><p>{detail.description}</p></div> : null}
          {detail.duties ? <div><h2>Görevler</h2><p>{detail.duties}</p></div> : null}
          {detail.dressCode ? <div><h2>Kıyafet</h2><p>{detail.dressCode}</p></div> : null}
        </div>
      ) : null}
    </section>
  );
}
