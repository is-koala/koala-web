import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { ApplicantReview } from "@/components/applicant-review";
import { ErrorState, LoadingState } from "@/components/states";
import { jobHeadcount } from "@/jobs/headcount";
import { publishedJobPath } from "@/lib/app-routes";
import { isUuid } from "@/lib/identifiers";
import {
  readJobApplicants,
  readTalentPoolMembership,
} from "@/server/applications/employer-review";
import { ApiError } from "@/server/api/errors";
import { notFoundStatus } from "@/server/contract";
import { failureView } from "@/server/form";
import { fetchJobDetail } from "@/server/jobs/jobs";
import { enterShell } from "@/server/session/viewer";

import {
  applicantConversationAction,
  applicantDossierAction,
  applicantTalentPoolAction,
} from "./actions";

export const metadata: Metadata = {
  title: "İlanın başvuruları",
  robots: { index: false, follow: false },
};

/**
 * Bir ilana gelen başvurular.
 *
 * Adres ilanın altında, kabuk menüsünde değil: başvuru tek başına bir kayıt
 * değil, bir **ilanın** başvurusu ve `GET /jobs/{jobId}/applications` dışında
 * onu getiren bir uç yok. Menüdeki "Başvurular" maddesi bu yüzden hâlâ
 * planlı — ilanlar arası bir gelen kutusu, creator bazlı ilan listesi
 * indiğinde kurulabilir (is-koala/koala-web#33).
 *
 * Burada `loading.tsx` yok: sayfa `notFound()` çağırıyor ve dış bir Suspense
 * sınırı HTTP durumunu 200'de kilitlerdi (`AGENTS.md`). Yükleniyor durumu,
 * karar verildikten sonra açılan iç `Suspense` ile veriliyor.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { viewer } = await enterShell();
  if (viewer === null) return null;

  const { id } = await params;
  // Kimlik tarayıcıdan geliyor ve yola giriyor; UUID olmayan değer hiç sorulmaz.
  if (!isUuid(id)) notFound();

  let job: Awaited<ReturnType<typeof fetchJobDetail>>;
  try {
    job = await fetchJobDetail(id);
  } catch (error) {
    // Backend yetkisiz kullanıcıya da 404 veriyor; ilanın varlığı sızmasın
    // diye web de aynı cevabı verir.
    if (error instanceof ApiError && error.status === notFoundStatus) notFound();
    const failure = failureView(error);
    return <ErrorState errorCode={failure.errorCode} status={failure.httpStatus} />;
  }

  const headcount = jobHeadcount({ headcount: job.headcount, hiredCount: job.hiredCount });

  return (
    <section className="app-panel applications-page">
      <p className="eyebrow">İlanın başvuruları</p>
      <h1>{job.title}</h1>
      <p className="lede">
        Adayları inceleyip yetenek havuzuna alabilir, ilanla ilgili yazışmayı buradan
        başlatabilirsin.
      </p>
      {/*
        Kontenjan sayısı ve belirsizliği birlikte duruyor: sayı gösterilip
        `hiredCount` ile kabul kapısının ayrıştığı söylenmezse, "yer var"
        yazan bir ilanda kabul beklenmedik biçimde reddedilebilir.
      */}
      <div className="job-headcount" role="status">
        <strong>{headcount.summary}</strong>
        {headcount.caveat ? <p className="field-hint">{headcount.caveat}</p> : null}
      </div>

      <Link className="button button-secondary button-small" href={publishedJobPath(id)}>
        İlana dön
      </Link>

      <Suspense fallback={<LoadingState label="Başvurular yükleniyor" />}>
        <JobApplicantsPanel jobId={id} />
      </Suspense>
    </section>
  );
}

/**
 * Başvuru listesi ve havuz üyeliği.
 *
 * İkisi birlikte okunuyor çünkü kart üzerindeki "havuzda mı" rozeti onlarsız
 * çizilemez; ayrı ayrı beklemek ekranı iki kez sıçratırdı.
 */
export async function JobApplicantsPanel({ jobId }: { jobId: string }) {
  const loaded = await Promise.all([readJobApplicants(jobId), readTalentPoolMembership()])
    .then(([applicants, inTalentPool]) => ({ applicants, inTalentPool }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  if ("failure" in loaded) {
    return <ErrorState errorCode={loaded.failure.errorCode} status={loaded.failure.httpStatus} />;
  }

  return (
    <ApplicantReview
      jobId={jobId}
      applicants={loaded.applicants}
      inTalentPool={[...loaded.inTalentPool]}
      dossierAction={applicantDossierAction}
      talentPoolAction={applicantTalentPoolAction}
      conversationAction={applicantConversationAction}
    />
  );
}
