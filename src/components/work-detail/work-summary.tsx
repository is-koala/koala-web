import type { WorkDetail, WorkEmployer } from "@/assignments/work-detail";
import {
  assignmentStatusLabel,
  formatAssignmentDate,
  formatMoney,
  paymentStatusLabel,
} from "@/components/assignment-presenters";
import {
  Avatar,
  StatusBadge,
  assignmentStatusTone,
  paymentStatusTone,
} from "@/components/ui";
import { employerTypeLabel } from "@/jobs/employer-jobs";
import { formatDateTime } from "@/lib/dates";

export function WorkSummary({ detail }: { detail: WorkDetail }) {
  const { assignment } = detail;
  const location = [assignment.districtName, assignment.cityName].filter(Boolean).join(", ");
  const employerBadge = employerTypeLabel(assignment.employerType);

  return (
    <section className="work-detail-summary" aria-labelledby="work-summary-heading">
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
        <p className="eyebrow">Çalışma ayrıntısı</p>
        <h1 id="work-summary-heading">{assignment.title}</h1>
        {/*
          Şirket adı işveren kartında; kart yoksa (ilan yanıtı işvereni
          taşımıyorsa) liste satırının `companyName`'i yine de görünsün.
        */}
        {!detail.employer && assignment.companyName ? (
          <p className="lede">{assignment.companyName}</p>
        ) : null}
      </div>
      {detail.employer ? <EmployerCard employer={detail.employer} /> : null}
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
        {/*
          `headcount` null ise ortada bir kontenjan yok (`jobs/headcount.ts`):
          "0 / ∞" yazmak olmayan bir kotayı bildirmek olurdu, satır çizilmiyor.
        */}
        {detail.headcount !== null ? (
          <div>
            <dt>Kontenjan</dt>
            <dd>{`${Math.max(0, detail.hiredCount)} / ${detail.headcount} kişi`}</dd>
          </div>
        ) : null}
        {detail.createdAt ? (
          <div>
            <dt>İlan tarihi</dt>
            <dd><time dateTime={detail.createdAt}>{formatDateTime(detail.createdAt)}</time></dd>
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
        {detail.additionalDirections ? (
          <p className="work-address-directions">
            <span className="muted">Tarif: </span>
            {detail.additionalDirections}
          </p>
        ) : null}
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

/**
 * İşveren kartı: şirkette logo + ad + web sitesi, bireysel ilanda ilanı açan
 * kişinin fotoğrafı ve adı. Web sitesi `safeExternalUrl` kapısından sunucuda
 * geçti; `rel="noopener noreferrer"` açılan sayfanın bu sekmeye erişimini
 * kapatıyor, adresi değil.
 */
function EmployerCard({ employer }: { employer: WorkEmployer }) {
  return (
    <div className="work-employer" data-testid="work-employer">
      <Avatar name={employer.name} src={employer.imageUrl} size="lg" />
      <div className="work-employer-copy">
        <span className="muted">{employer.kind === "company" ? "Şirket" : "İşveren"}</span>
        <strong>{employer.name}</strong>
        {employer.website ? (
          <a className="text-link" href={employer.website} rel="noopener noreferrer" target="_blank">
            Web sitesi
          </a>
        ) : null}
      </div>
    </div>
  );
}
