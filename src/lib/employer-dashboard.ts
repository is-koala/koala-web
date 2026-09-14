import type { JobApplicant } from "@/applications/employer-review";
import type { EmployerJob, EmployerJobPage } from "@/jobs/employer-jobs";
import { canStartPayment } from "@/payments/checkout";
import type { EmployerAssignment, EmployerAssignmentPage } from "@/payments/contract";

/**
 * İşveren ana sayfasının özet sayıları.
 *
 * Yeni bir uç yok (is-koala/koala-web#156): sayılar ilan listesinin ilk
 * sayfasından (`GET /users/me/jobs`) ve atama listesinden
 * (`GET /users/me/assignments?asEmployer=true`) türüyor. İki liste de
 * sayfalı; bir sayfaya sığmayan hesap `partial` ile işaretlenir ve kart bunu
 * "ilk N kayıt" diye yazar — eksik bir sayıyı tam gibi göstermek, işverene
 * bekleyen bir başvurunun olmadığını söylerdi.
 */
export type EmployerSummary = {
  readonly openJobs: number;
  /**
   * Açık ilanlardaki, henüz işe alıma dönüşmemiş başvurular.
   *
   * `JobSummaryDto` yalnız toplam başvuru ve işe alınan sayısını taşıyor;
   * reddedilen ya da geri çekilen başvuru ayrıca sayılmıyor. Bu yüzden sayı
   * "karar bekleyen" değil "işe alınmamış" başvuru: üst sınır, alt sınır değil.
   */
  readonly openApplications: number;
  readonly activeAssignments: number;
  /** Ödemesi şimdi başlatılabilen atamalar (`canStartPayment`). */
  readonly pendingPayments: number;
  /** Liste tek sayfaya sığmadıysa özet eksik; kartlar bunu yazar. */
  readonly partial: { readonly jobs: boolean; readonly assignments: boolean };
};

const activeAssignmentStatuses = new Set<EmployerAssignment["status"]>([
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "IN_PROGRESS",
]);

export function employerSummary({
  jobs,
  assignments,
}: {
  jobs: EmployerJobPage;
  assignments: EmployerAssignmentPage;
}): EmployerSummary {
  const openJobs = jobs.content.filter((job) => job.status === "OPEN");
  const openApplications = openJobs.reduce(
    (sum, job) => sum + Math.max(job.applicationCount - job.hiredCount, 0),
    0,
  );

  return {
    openJobs: openJobs.length,
    openApplications,
    activeAssignments: assignments.content.filter((assignment) =>
      activeAssignmentStatuses.has(assignment.status),
    ).length,
    pendingPayments: assignments.content.filter((assignment) => canStartPayment(assignment)).length,
    partial: {
      jobs: !jobs.last && jobs.totalPages > 1,
      assignments: !assignments.last && assignments.totalPages > 1,
    },
  };
}

/** Son başvurular için okunacak ilanlar: en yeni açık ilanlardan başvurusu olanlar. */
export const recentApplicationJobLimit = 3;
export const recentApplicationLimit = 5;

export function jobsWorthReadingApplicants(jobs: readonly EmployerJob[]): readonly EmployerJob[] {
  return jobs
    .filter((job) => job.status === "OPEN" && job.applicationCount > 0)
    .slice(0, recentApplicationJobLimit);
}

export type RecentApplication = {
  readonly application: JobApplicant;
  readonly job: EmployerJob;
};

/**
 * Birden çok ilanın başvurularını tek bir "son başvurular" listesine indirger.
 *
 * Sıra `appliedAt`'e göre, en yeni önce; eşitlikte ilan sırası korunur.
 * Tarih okunamayan kayıt listenin sonuna düşer, atlanmaz.
 */
export function recentApplications(
  entries: ReadonlyArray<{ job: EmployerJob; applicants: readonly JobApplicant[] }>,
  limit = recentApplicationLimit,
): readonly RecentApplication[] {
  return entries
    .flatMap(({ job, applicants }) => applicants.map((application) => ({ application, job })))
    .sort((a, b) => appliedAtValue(b.application) - appliedAtValue(a.application))
    .slice(0, limit);
}

function appliedAtValue(application: JobApplicant): number {
  const value = Date.parse(application.appliedAt);
  return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
}
