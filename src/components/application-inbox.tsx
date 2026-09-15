import Link from "next/link";

import { applicantStatusLabel } from "@/applications/employer-review";
import {
  inboxHasActiveFilters,
  inboxHref,
  inboxJobChoices,
  inboxReviewHref,
  inboxStatusOptions,
  type InboxCompanyOption,
  type InboxQuery,
  type ReceivedApplication,
  type ReceivedApplicationPage,
} from "@/applications/inbox";
import { ApplicantNameLink } from "@/components/applicant-name-link";
import {
  Avatar,
  EmptyStateCard,
  Field,
  FactList,
  LinkTabs,
  ListRow,
  ListRows,
  StatusBadge,
  applicationStatusTone,
  jobStatusTone,
} from "@/components/ui";
import { jobStatusLabel } from "@/jobs/lifecycle";
import { employerApplicationsPath } from "@/lib/app-routes";
import { formatDateTime, isFormattableDate } from "@/lib/dates";
import { safeImageUrl } from "@/lib/urls";

/**
 * İşverenin ilanlar arası başvuru listesi.
 *
 * Süzgeç ve sayfa adres çubuğunda: uç sayfalı ve her sayfa yeni bir istek,
 * yani paylaşılan bağlantı aynı kümeyi açmalı. İnceleme ise ilanın kendi
 * ekranında; gelen kutu karar vermez, oraya götürür.
 */
export function ApplicationInbox({
  page,
  query,
  companies,
}: {
  page: ReceivedApplicationPage;
  query: InboxQuery;
  companies: readonly InboxCompanyOption[];
}) {
  const jobs = inboxJobChoices(page.content, query.jobId);
  const filtered = inboxHasActiveFilters(query);

  return (
    <div className="application-list">
      <LinkTabs
        label="Başvuru durumu"
        items={inboxStatusOptions.map((option) => ({
          href: inboxHref({ ...query, status: option.value, page: 0 }),
          label: option.label,
          current: query.status === option.value,
        }))}
      />

      {companies.length > 0 ? (
        <LinkTabs
          label="Şirket"
          items={[
            {
              href: inboxHref({ ...query, companyId: null, page: 0 }),
              label: "Tüm şirketler",
              current: query.companyId === null,
            },
            ...companies.map((company) => ({
              href: inboxHref({ ...query, companyId: company.companyId, page: 0 }),
              label: company.companyName,
              current: query.companyId === company.companyId,
            })),
          ]}
        />
      ) : null}

      <JobFilter jobs={jobs} query={query} />

      {page.content.length === 0 ? (
        <EmptyStateCard
          title={filtered ? "Bu süzgeçte başvuru yok" : "Henüz başvuru yok"}
          message={
            filtered
              ? "Başka bir durum, ilan ya da şirket süzgeci seçerek başvuruları inceleyebilirsin."
              : "Yetkilisi olduğun şirketlerin ve açtığın bireysel ilanların başvuruları burada görünecek."
          }
          mascot="employer"
        />
      ) : (
        <ListRows aria-label="Gelen başvurular">
          {page.content.map((application) => (
            <InboxRow key={application.id} application={application} />
          ))}
        </ListRows>
      )}

      {page.totalPages > 1 || page.page > 0 ? (
        <nav className="application-pagination" aria-label="Başvuru sayfaları">
          {page.first ? <span /> : (
            <Link href={inboxHref({ ...query, page: Math.max(0, page.page - 1) })}>
              Önceki sayfa
            </Link>
          )}
          <span>
            Sayfa {page.page + 1} / {Math.max(page.totalPages, 1)}
          </span>
          {page.last ? <span /> : (
            <Link href={inboxHref({ ...query, page: page.page + 1 })}>Sonraki sayfa</Link>
          )}
        </nav>
      ) : null}
    </div>
  );
}

function JobFilter({
  jobs,
  query,
}: {
  jobs: ReturnType<typeof inboxJobChoices>;
  query: InboxQuery;
}) {
  if (jobs.length === 0 && query.jobId === null) return null;

  return (
    <form className="inbox-job-filter" method="get" action={employerApplicationsPath}>
      {query.status !== "ALL" ? <input type="hidden" name="status" value={query.status} /> : null}
      {query.companyId ? <input type="hidden" name="companyId" value={query.companyId} /> : null}
      <Field id="inbox-job" label="İlan">
        <select id="inbox-job" name="jobId" defaultValue={query.jobId ?? ""}>
          <option value="">Tüm ilanlar</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>
      </Field>
      <button className="button button-secondary button-small" type="submit">
        İlana göre süz
      </button>
    </form>
  );
}

function InboxRow({ application }: { application: ReceivedApplication }) {
  const titleId = `inbox-${application.id}`;
  const jobClosed = application.jobStatus === "CLOSED" || application.jobStatus === "CANCELLED";
  const name = application.applicant.fullName || "Adı paylaşılmadı";

  return (
    <ListRow
      as="li"
      aria-labelledby={titleId}
      leading={
        <Avatar name={name} src={safeImageUrl(application.applicant.profilePictureUrl)} />
      }
      title={
        <span id={titleId}>
          <ApplicantNameLink workerId={application.applicant.id} name={name} />
        </span>
      }
      meta={
        <>
          <span>{application.postingTitle}</span>
          {application.companyName ? <span>{application.companyName}</span> : null}
          {isFormattableDate(application.appliedAt) ? (
            <time dateTime={application.appliedAt}>{formatDateTime(application.appliedAt)}</time>
          ) : null}
        </>
      }
      trailing={
        <>
          <StatusBadge tone={applicationStatusTone(application.status)}>
            {applicantStatusLabel[application.status]}
          </StatusBadge>
          {jobClosed ? (
            <StatusBadge tone={jobStatusTone(application.jobStatus)}>
              {jobStatusLabel(application.jobStatus)}
            </StatusBadge>
          ) : null}
          <Link className="button button-secondary button-small" href={inboxReviewHref({
            jobId: application.jobId,
            applicationId: application.id,
          })}>
            Başvuruyu incele
          </Link>
        </>
      }
    >
      <FactList
        facts={[
          application.notes ? { term: "Başvuru notu", detail: application.notes } : null,
          application.answeredAt && isFormattableDate(application.answeredAt)
            ? {
                term: application.status === "REJECTED" ? "Red tarihi" : "Yanıt tarihi",
                detail: (
                  <time dateTime={application.answeredAt}>
                    {formatDateTime(application.answeredAt)}
                  </time>
                ),
              }
            : null,
        ]}
      />
    </ListRow>
  );
}
