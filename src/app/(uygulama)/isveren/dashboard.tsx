import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense, cache } from "react";

import { applicantStatusLabel } from "@/applications/employer-review";
import { LoadingState } from "@/components/states";
import {
  Avatar,
  Card,
  EmptyStateCard,
  Icon,
  ListRow,
  ListRows,
  SectionHeader,
  StatCard,
  StatusBadge,
  applicationStatusTone,
} from "@/components/ui";
import { defaultJobSort } from "@/jobs/employer-jobs";
import {
  employerApplicationsPath,
  employerJobsPath,
  jobApplicantsPath,
  newCompanyJobPath,
  newIndividualJobPath,
  talentPoolPath,
} from "@/lib/app-routes";
import { formatDateTime } from "@/lib/dates";
import {
  employerSummary,
  jobsWorthReadingApplicants,
  recentApplications,
  type EmployerSummary,
} from "@/lib/employer-dashboard";
import { safeImageUrl } from "@/lib/urls";
import { readJobApplicants } from "@/server/applications/employer-review";
import { failureView } from "@/server/form";
import { readMyJobs } from "@/server/jobs/jobs";
import { readEmployerAssignments } from "@/server/payments/payments";
import type { Viewer } from "@/server/session/viewer";

const employerAssignmentsPath = "/isveren/atamalar";
const employerPaymentsPath = "/isveren/odemeler";

/* İki blok da ilan listesinin ilk sayfasını okuyor; istek başına bir tur. */
const firstJobsPage = cache(() => readMyJobs({ page: 0, sort: defaultJobSort }));

/**
 * İşveren ana sayfası: özet kartlar, hızlı eylemler, son başvurular.
 *
 * Yeni uç yok; her blok bölümlerin zaten okuduğu listelerden besleniyor
 * (`lib/employer-dashboard.ts`). Bloklar ayrı `Suspense` sınırlarında:
 * kabuk kökünde `loading.tsx` olamaz (`[...section]` 404'ü 200'e kilitlerdi,
 * `AGENTS.md`), yükleniyor durumu bu yüzden karar verildikten sonra açılan
 * iç sınırlarda. Bir blok arızalanınca yalnız o blok "okunamadı" yazar;
 * ana sayfa hâlâ hızlı eylemlerini sunar.
 */
export function EmployerDashboard({ viewer }: { viewer: Viewer }) {
  return (
    <div className="dashboard">
      <Suspense fallback={<SummarySkeleton />}>
        <SummaryCards />
      </Suspense>

      <div className="dashboard-grid">
        <Card as="section" className="dashboard-card" aria-labelledby="dashboard-recent">
          <SectionHeader
            title="Son başvurular"
            titleId="dashboard-recent"
            actions={
              <Link className="text-link" href={employerApplicationsPath}>
                Tüm başvurular
              </Link>
            }
          />
          <Suspense fallback={<LoadingState label="Son başvurular yükleniyor" />}>
            <RecentApplications />
          </Suspense>
        </Card>

        <Card as="section" className="dashboard-card" aria-labelledby="dashboard-actions">
          <SectionHeader title="Hızlı işlemler" titleId="dashboard-actions" />
          <QuickActions companies={viewer.companies} />
        </Card>
      </div>
    </div>
  );
}

async function SummaryCards() {
  const loaded = await Promise.all([firstJobsPage(), readEmployerAssignments(0, 100)])
    .then(([jobs, assignments]) => ({ summary: employerSummary({ jobs, assignments }) }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  if ("failure" in loaded) {
    return (
      <p className="dashboard-unavailable" role="status">
        Özet sayılar şu an okunamadı; bölümlere menüden ulaşabilirsin.
      </p>
    );
  }

  return <SummaryGrid summary={loaded.summary} />;
}

/**
 * Dört özet kart. Kartlar bağlantı: sayı bir sorunun cevabı ve cevabın
 * ardındaki liste bir tık uzakta olmalı.
 */
export function SummaryGrid({ summary }: { summary: EmployerSummary }) {
  return (
    <div className="dashboard-stats" role="list" aria-label="Özet">
      <div role="listitem">
        <StatCard
          label="Açık ilan"
          value={countLabel(summary.openJobs, summary.partial.jobs)}
          icon="briefcase"
          accent="green"
          href={employerJobsPath}
          hint={summary.partial.jobs ? "ilk sayfadaki ilanlar" : undefined}
        />
      </div>
      <div role="listitem">
        <StatCard
          label="Bekleyen başvuru"
          value={countLabel(summary.openApplications, summary.partial.jobs)}
          icon="users"
          accent="purple"
          href={employerApplicationsPath}
          hint={
            summary.partial.jobs
              ? "ilk sayfadaki açık ilanlarda, işe alınmamış"
              : "açık ilanlarda, işe alınmamış"
          }
        />
      </div>
      <div role="listitem">
        <StatCard
          label="Aktif atama"
          value={countLabel(summary.activeAssignments, summary.partial.assignments)}
          icon="calendar"
          accent="blue"
          href={employerAssignmentsPath}
          hint={summary.partial.assignments ? "ilk 100 atama" : undefined}
        />
      </div>
      <div role="listitem">
        <StatCard
          label="Bekleyen ödeme"
          value={countLabel(summary.pendingPayments, summary.partial.assignments)}
          icon="wallet"
          accent="amber"
          href={employerPaymentsPath}
          hint={
            summary.partial.assignments
              ? "ilk 100 atamada şimdi ödenebilecekler"
              : "şimdi ödenebilecek atamalar"
          }
        />
      </div>
    </div>
  );
}

/**
 * Sayı ile eksikliği birlikte yazar: liste tek sayfaya sığmadıysa "5+" —
 * sayı bir alt sınır ve kullanıcı bunu kartın kendisinden okumalı, yalnız
 * alt yazıdan değil.
 */
function countLabel(count: number, partial: boolean): string {
  return partial ? `${count}+` : String(count);
}

function SummarySkeleton() {
  return (
    <div className="dashboard-stats animate-pulse" role="status" aria-live="polite" aria-label="Özet yükleniyor">
      <StatCard label="Açık ilan" value="…" icon="briefcase" accent="green" />
      <StatCard label="Bekleyen başvuru" value="…" icon="users" accent="purple" />
      <StatCard label="Aktif atama" value="…" icon="calendar" accent="blue" />
      <StatCard label="Bekleyen ödeme" value="…" icon="wallet" accent="amber" />
    </div>
  );
}

/**
 * Hızlı eylemler. "Şablonla ilan aç" ayrı bir sayfa değil: bireysel ilan
 * formunun ilk adımı şablon seçici (`JobForm`, `SelectField name="jobTemplateId"`,
 * kimliği adından geliyor) ve bağlantı parçayla doğrudan o alana iner.
 */
function QuickActions({
  companies,
}: {
  companies: readonly { companyId: string; companyName: string }[];
}) {
  return (
    <ul className="quick-actions">
      <li>
        <Link className="quick-action" href={newIndividualJobPath}>
          <span className="quick-action-icon">
            <Icon name="plus" size={20} />
          </span>
          <span>
            <strong>Yeni ilan</strong>
            <span>Kendi adına bir günlük iş ilanı aç.</span>
          </span>
          <Icon name="arrowRight" size={18} />
        </Link>
      </li>
      <li>
        <Link className="quick-action" href={`${newIndividualJobPath}#jobTemplateId`}>
          <span className="quick-action-icon">
            <Icon name="template" size={20} />
          </span>
          <span>
            <strong>Şablonla ilan aç</strong>
            <span>Hazır şablonu seç, yalnız tarih ve adresi doldur.</span>
          </span>
          <Icon name="arrowRight" size={18} />
        </Link>
      </li>
      {companies.map((company) => (
        <li key={company.companyId}>
          <Link className="quick-action" href={newCompanyJobPath(company.companyId)}>
            <span className="quick-action-icon">
              <Icon name="building" size={20} />
            </span>
            <span>
              <strong>{company.companyName} adına ilan</strong>
              <span>Şirket adına ilan aç.</span>
            </span>
            <Icon name="arrowRight" size={18} />
          </Link>
        </li>
      ))}
      <li>
        <Link className="quick-action" href={talentPoolPath}>
          <span className="quick-action-icon">
            <Icon name="star" size={20} />
          </span>
          <span>
            <strong>Yetenek havuzu</strong>
            <span>Beğendiğin adaylara yeniden ulaş.</span>
          </span>
          <Icon name="arrowRight" size={18} />
        </Link>
      </li>
    </ul>
  );
}

/**
 * Son başvurular.
 *
 * Ana sayfa hâlâ creator bazlı ilan listesinin ilk sayfasından bir pencere
 * derliyor — gelen kutunun tam listesi `employerApplicationsPath`. Not bunu
 * söyler ki pencere tam kutu sanılmasın.
 */
async function RecentApplications() {
  const loaded = await firstJobsPage()
    .then(async (jobs) => {
      const candidates = jobsWorthReadingApplicants(jobs.content);
      const entries = await Promise.all(
        candidates.map(async (job) => ({ job, applicants: await readJobApplicants(job.id) })),
      );
      return { recent: recentApplications(entries), hasOpenJobs: jobs.content.some((job) => job.status === "OPEN") };
    })
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  if ("failure" in loaded) {
    return (
      <p className="dashboard-unavailable" role="status">
        Başvurular şu an okunamadı.
      </p>
    );
  }

  if (loaded.recent.length === 0) {
    return (
      <EmptyStateCard
        title={loaded.hasOpenJobs ? "Henüz başvuru yok" : "Açık ilanın yok"}
        message={
          loaded.hasOpenJobs
            ? "Açık ilanlarına gelen başvurular burada görünecek."
            : "Bir ilan açtığında gelen başvurular burada görünecek."
        }
        mascot="employer"
      >
        {loaded.hasOpenJobs ? null : (
          <Link className="button button-primary button-small" href={newIndividualJobPath}>
            İlan aç
          </Link>
        )}
      </EmptyStateCard>
    );
  }

  return (
    <div className="recent-applications">
      <ListRows aria-label="Son başvurular">
        {loaded.recent.map(({ application, job }) => (
          <ListRow
            key={application.id}
            leading={
              <Avatar
                name={application.applicant.fullName || "?"}
                src={safeImageUrl(application.applicant.profilePictureUrl)}
              />
            }
            title={application.applicant.fullName || "Adı paylaşılmadı"}
            meta={
              <>
                <Link className="text-link" href={jobApplicantsPath(job.id)}>
                  {job.title}
                </Link>
                <time dateTime={application.appliedAt}>{formatDateTime(application.appliedAt)}</time>
              </>
            }
            trailing={
              <StatusBadge tone={applicationStatusTone(application.status)}>
                {applicantStatusLabel[application.status]}
              </StatusBadge>
            }
          />
        ))}
      </ListRows>
      <p className="dashboard-note">
        En yeni üç açık ilanın son başvuruları. Tamamı için gelen kutusuna git.
      </p>
    </div>
  );
}
