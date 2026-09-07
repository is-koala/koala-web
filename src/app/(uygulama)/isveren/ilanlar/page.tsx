import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

import { ShellGate } from "@/app/(uygulama)/shell";
import { EmployerJobList } from "@/components/employer-job-list";
import { ErrorState } from "@/components/states";
import { parseJobSort } from "@/jobs/employer-jobs";
import { employerJobsPath, newCompanyJobPath, newIndividualJobPath } from "@/lib/app-routes";
import { failureView } from "@/server/form";
import { readMyJobs } from "@/server/jobs/jobs";
import { enterShell } from "@/server/session/viewer";

export const metadata: Metadata = {
  title: "İlanlarım",
  robots: { index: false, follow: false },
};

type EmployerJobsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function Page({ searchParams }: EmployerJobsPageProps) {
  return (
    <ShellGate shell="employer" href={employerJobsPath}>
      <EmployerJobsPage searchParams={searchParams} />
    </ShellGate>
  );
}

/**
 * İşverenin açtığı ilanlar.
 *
 * Başlık "İlanlarım" değil **"Benim açtığım ilanlar"**, ve bu bir üslup
 * tercihi değil: `GET /users/me/jobs` yalnız `findAllByCreatorId` ile çalışıyor
 * (`JobManager.java:333`), yani bir şirketin ikinci yetkilisi başka bir
 * yetkilinin açtığı şirket ilanını bu listede **göremiyor**. Backend'de şirket
 * bazlı bir liste ucu yok; web bunu düzeltemez ama gizlememeli — "İlanlarım"
 * başlığı altındaki eksik liste, kullanıcıya ilanının silindiğini
 * düşündürürdü.
 */
export async function EmployerJobsPage({ searchParams }: EmployerJobsPageProps) {
  const { viewer, failure } = await enterShell();
  if (failure !== null || viewer === null) return null;

  const query = await searchParams;
  const sort = parseJobSort(query.sort);
  const page = parsePage(query.page);

  const result = await readMyJobs({ page, sort })
    .then((jobs) => ({ jobs }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  return (
    <section className="app-panel employer-jobs-page">
      <p className="eyebrow">İşveren</p>
      <h1>Benim açtığım ilanlar</h1>
      <p className="lede">
        Burada yalnız senin açtığın ilanlar var. Yetkilisi olduğun bir şirkette başka bir
        yetkilinin açtığı ilanlar bu listeye düşmüyor; onları o ilanın bağlantısından
        görebilirsin.
      </p>

      <NewJobLinks companies={viewer.companies} />

      {"failure" in result ? (
        <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />
      ) : (
        <EmployerJobList jobs={result.jobs} sort={sort} />
      )}
    </section>
  );
}

/**
 * İlanın hangi kimlikle açılacağı.
 *
 * Seçim burada yapılıyor çünkü iki yol iki ayrı backend ucuna gidiyor ve
 * kapıları farklı: bireysel ilan işveren rolü ile kimlik doğrulaması istiyor,
 * şirket ilanı yalnız o şirketin yetkilisi olmayı. Tek bir "Yeni ilan"
 * düğmesi, kullanıcıyı formun sonunda yanlış uca çarptırırdı.
 */
function NewJobLinks({
  companies,
}: {
  companies: readonly { companyId: string; companyName: string }[];
}) {
  return (
    <nav className="employer-job-actions" aria-label="Yeni ilan aç">
      <Link className="button button-primary" href={newIndividualJobPath}>
        Kendi adıma ilan aç
      </Link>
      {companies.map((company) => (
        <Link
          key={company.companyId}
          className="button button-secondary"
          href={newCompanyJobPath(company.companyId)}
        >
          {company.companyName} adına ilan aç
        </Link>
      ))}
    </nav>
  );
}

function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 0;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 0;
}
