import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";

import { EmployerJobFacts, JobDetailBody } from "@/components/job-detail";
import { JobLifecycleActions } from "@/components/job-lifecycle-actions";
import { ErrorState } from "@/components/states";
import { PageHeader, PagePanel, StatusBadge, jobStatusTone } from "@/components/ui";
import { jobStatusLabel } from "@/jobs/lifecycle";
import { jobApplicantsPath, jobGalleryPath } from "@/lib/app-routes";
import { isUuid } from "@/lib/identifiers";
import { ApiError } from "@/server/api/errors";
import { notFoundStatus } from "@/server/contract";
import { failureView } from "@/server/form";
import { fetchJobDetail, type EmployerJobDetail } from "@/server/jobs/jobs";
import { enterShell } from "@/server/session/viewer";

import { jobLifecycleAction } from "./actions";

export const metadata: Metadata = {
  title: "İlanım",
  robots: { index: false, follow: false },
};

/**
 * Yayımlanmış ilanın sayfası.
 *
 * Gövde herkese açık ilan sayfasıyla ortak (`EmployerJobFacts`, `JobDetailBody`,
 * is-koala/koala-web#166): tarih/saat, adres ve kesinliği, kontenjan,
 * açıklama, görevler, aranan özellikler, galeri, kilitlenen fiyat ve yayın
 * tarihi aynı bileşenlerden çıkıyor. Bu sayfa ona yalnız sahibin gördüğünü
 * ekliyor — durum rozeti, başvuru sayısı, sunucunun sahibe kurduğu adres
 * satırı — ve işveren eylemlerini: başvurular, galeri, kapatma ve iptal.
 *
 * Fiyat dökümü ADR-0002 uyarınca yayımda kilitleniyor; kullanıcının onu
 * yayımdan sonra da görebileceği yer burası.
 *
 * Burada `loading.tsx` yok: bu sayfa `notFound()` çağırıyor ve bir Suspense
 * sınırı HTTP durumunu 200'de kilitlerdi (`AGENTS.md`).
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { viewer } = await enterShell();
  if (viewer === null) return null;

  const { id } = await params;
  // Kimlik tarayıcıdan geliyor ve yola giriyor: UUID olmayan bir değer
  // backend'e hiç sorulmaz (`server/address/gateway.ts` aynı kuralı yazıyor).
  if (!isUuid(id)) notFound();

  let job: EmployerJobDetail;
  try {
    job = await fetchJobDetail(id);
  } catch (error) {
    unstable_rethrow(error);
    // Backend yetkisiz kullanıcıya da 404 veriyor; ilanın varlığı sızmasın
    // diye web de aynı cevabı verir.
    if (error instanceof ApiError && error.status === notFoundStatus) notFound();
    const failure = failureView(error);
    return <ErrorState errorCode={failure.errorCode} status={failure.httpStatus} />;
  }

  return (
    <PagePanel className="employer-job-detail">
      <PageHeader
        eyebrow="İlanım"
        title={job.title}
        actions={
          <>
            {/*
              Başvuruların menüde bir maddesi yok: bir başvuru bir **ilanın**
              kaydı ve `GET /jobs/{jobId}/applications` dışında onları getiren
              bir uç yok. İlanı görüntüleyen kullanıcının başvurulara ulaştığı
              tek yer burası.
            */}
            <Link className="button button-primary button-small" href={jobApplicantsPath(id)}>
              Başvuruları gör
            </Link>
            <Link className="button button-secondary button-small" href={jobGalleryPath(id)}>
              Galeriyi yönet
            </Link>
          </>
        }
      >
        <StatusBadge tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</StatusBadge>
      </PageHeader>

      <EmployerJobFacts
        job={job}
        address={job.displayAddress}
        applicationCount={job.applicationCount}
        className="employer-job-facts"
      />

      <JobDetailBody job={job} className="employer-job-body" />

      {job.pricing === null ? (
        <p className="field-hint">Bu ilanın fiyat dökümü okunamadı.</p>
      ) : null}

      {/*
        Kimlik `id`'den bağlanıyor, yanıttaki `job.id`'den değil: bu değer
        yukarıda UUID olarak doğrulandı ve action aynı doğrulamayı tekrar
        yapıyor.
      */}
      <JobLifecycleActions status={job.status} action={jobLifecycleAction.bind(null, id)} />
    </PagePanel>
  );
}
