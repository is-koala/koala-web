import Link from "next/link";

import { EmptyState } from "@/components/states";
import { LinkTabs, StatusBadge, jobStatusTone } from "@/components/ui";
import {
  jobSortOptions,
  type EmployerJob,
  type EmployerJobPage,
  type JobSort,
} from "@/jobs/employer-jobs";
import { jobStatusLabel } from "@/jobs/lifecycle";
import { employerJobsPath, publishedJobPath } from "@/lib/app-routes";
import { formatJobDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

/**
 * İşverenin açtığı ilanların listesi.
 *
 * İstemci bileşeni **değil**: sıralama ve sayfa adres çubuğunda taşınıyor,
 * yani paylaşılan bir bağlantı aynı listeyi açıyor ve geri düğmesi çalışıyor.
 * Yerel durumda tutulsalardı ikisi de kaybolurdu.
 */
export function EmployerJobList({
  jobs,
  sort,
}: {
  jobs: EmployerJobPage;
  sort: JobSort;
}) {
  return (
    <div className="employer-job-list">
      <SortChoice sort={sort} />

      {jobs.content.length === 0 ? (
        <EmptyState kind="employerJobs" />
      ) : (
        <div className="employer-job-grid">
          {jobs.content.map((job) => (
            <EmployerJobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      <Pagination jobs={jobs} sort={sort} />
    </div>
  );
}

/**
 * Sıralama seçenekleri.
 *
 * Liste `jobSortOptions`'tan çiziliyor ve orası `JobManager.SORTABLE_FIELDS`
 * ile hizalı: elle yazılmış beşinci bir bağlantı, tıklandığında 400 dönen bir
 * düğme olurdu (`PAGE_SORT_FIELD_NOT_ALLOWED`).
 */

function ownerBadge(job: EmployerJob): string {
  if (job.employerType === "COMPANY") {
    return job.companyName ? `Şirket ilanı · ${job.companyName}` : "Şirket ilanı";
  }
  if (job.employerType === "INDIVIDUAL") return "Bireysel ilan";
  return "";
}

function SortChoice({ sort }: { sort: JobSort }) {
  return (
    <LinkTabs
      label="Sıralama"
      items={jobSortOptions.map((option) => ({
        href: employerJobsHref(option.value, 0),
        label: option.label,
        current: option.value === sort,
      }))}
    />
  );
}

function Pagination({ jobs, sort }: { jobs: EmployerJobPage; sort: JobSort }) {
  if (jobs.totalPages <= 1 && jobs.page === 0) return null;

  return (
    <nav className="employer-job-pagination" aria-label="İlan sayfaları">
      {jobs.first ? (
        <span />
      ) : (
        <Link href={employerJobsHref(sort, Math.max(0, jobs.page - 1))}>Önceki sayfa</Link>
      )}
      <span>
        Sayfa {jobs.page + 1} / {Math.max(jobs.totalPages, 1)}
      </span>
      {jobs.last ? <span /> : <Link href={employerJobsHref(sort, jobs.page + 1)}>Sonraki sayfa</Link>}
    </nav>
  );
}

function EmployerJobCard({ job }: { job: EmployerJob }) {
  const titleId = `job-${job.id}`;
  const location = [job.districtName, job.cityName].filter(Boolean).join(", ");

  return (
    <article className="employer-job-card" aria-labelledby={titleId}>
      <div className="employer-job-card-head">
        <h2 id={titleId}>
          <Link className="text-link" href={publishedJobPath(job.id)}>
            {job.title}
          </Link>
        </h2>
        <StatusBadge tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</StatusBadge>
      </div>

      <p className="employer-job-owner">
        {ownerBadge(job)}
        {job.insuranceRequired ? " · Sigortalı çalışma" : ""}
      </p>

      <dl className="employer-job-facts">
        {job.position ? (
          <div>
            <dt>Pozisyon</dt>
            <dd>{job.position}</dd>
          </div>
        ) : null}
        <div>
          <dt>İş tarihi</dt>
          <dd>{formatJobDate(job.startsAt)}</dd>
        </div>
        {location ? (
          <div>
            <dt>Konum</dt>
            <dd>{location}</dd>
          </div>
        ) : null}
        <div>
          <dt>Başvuru</dt>
          <dd>{job.applicationCount}</dd>
        </div>
        <div>
          <dt>İşe alınan</dt>
          <dd>{job.hiredCount}</dd>
        </div>
        {job.headcount === null ? null : (
          <div>
            <dt>Aranan kişi</dt>
            <dd>{job.headcount}</dd>
          </div>
        )}
      </dl>

      {/*
        Ücret yalnız kilitlenmiş fiyat anlık görüntüsünden geliyor (ADR-0002).
        Snapshot yoksa bir tutar uydurmak, kullanıcının ödeyeceği rakamla
        ayrışabilirdi.
      */}
      <p className="employer-job-payout">
        {job.workerPayout && job.currency ? (
          <>
            <span>Çalışan ücreti</span>{" "}
            <strong>{formatMoney(job.workerPayout, job.currency)}</strong>
          </>
        ) : (
          "Bu ilanın ücret dökümü okunamadı."
        )}
      </p>
    </article>
  );
}

/** Sıralama ve sayfa birlikte taşınıyor: biri değişince öbürü sıfırlanmamalı. */
function employerJobsHref(sort: JobSort, page: number): string {
  const search = new URLSearchParams({ sort });
  if (page > 0) search.set("page", String(page));
  return `${employerJobsPath}?${search}`;
}
