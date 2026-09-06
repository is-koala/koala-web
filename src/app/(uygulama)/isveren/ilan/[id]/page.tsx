import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobLifecycleActions } from "@/components/job-lifecycle-actions";
import { ErrorState } from "@/components/states";
import { jobStatusLabel } from "@/jobs/lifecycle";
import { isUuid } from "@/lib/identifiers";
import { formatMoney } from "@/lib/money";
import { ApiError } from "@/server/api/errors";
import { notFoundStatus } from "@/server/contract";
import { failureView } from "@/server/form";
import { fetchJobDetail, type JobDetail } from "@/server/jobs/jobs";
import { enterShell } from "@/server/session/viewer";

import { jobLifecycleAction } from "./actions";

export const metadata: Metadata = {
  title: "İlanım",
  robots: { index: false, follow: false },
};

/**
 * Yayımlanmış ilanın sayfası.
 *
 * Bugün yalnız okuyor: yayımın gerçekten olduğunu ve **fiyatın hangi
 * değerlerle donduğunu** gösteriyor. ADR-0002 fiyatı ilan yayımlandığında
 * kilitliyor, yani bu üç sayı bir daha değişmiyor ve kullanıcının onları
 * yayımdan sonra da görebileceği bir yer olması gerekiyor.
 *
 * Kapatma ve iptal eylemleri de burada: ikisi de ilanın kendi kaydına ait ve
 * hangisinin mümkün olduğunu ilanın durumu söylüyor.
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

  let job: JobDetail;
  try {
    job = await fetchJobDetail(id);
  } catch (error) {
    // Backend yetkisiz kullanıcıya da 404 veriyor; ilanın varlığı sızmasın
    // diye web de aynı cevabı verir.
    if (error instanceof ApiError && error.status === notFoundStatus) notFound();
    const failure = failureView(error);
    return <ErrorState errorCode={failure.errorCode} status={failure.httpStatus} />;
  }

  return (
    <section className="app-panel">
      <p className="eyebrow">İlanım</p>
      <h1>{job.title}</h1>
      <p className="lede">{jobStatusLabel(job.status)}</p>

      {job.pricing === null ? (
        <p>Bu ilanın fiyat dökümü okunamadı.</p>
      ) : (
        <div className="price-breakdown" role="group" aria-label="Kilitlenen fiyat">
          <p className="price-line">
            <span>Çalışan ücreti</span>
            <strong>{formatMoney(job.pricing.workerPayout, job.pricing.currency)}</strong>
          </p>
          <p className="price-line">
            <span>Koala hizmet bedeli</span>
            <strong>{formatMoney(job.pricing.serviceFeeAmount, job.pricing.currency)}</strong>
          </p>
          <p className="price-line">
            <span>İşveren toplamı</span>
            <strong>{formatMoney(job.pricing.employerTotal, job.pricing.currency)}</strong>
          </p>
        </div>
      )}

      <p className="field-hint">
        Bu fiyat ilan yayımlandığında kilitlendi ve değişmiyor.
      </p>

      {/*
        Kimlik `id`'den bağlanıyor, yanıttaki `job.id`'den değil: bu değer
        yukarıda UUID olarak doğrulandı ve action aynı doğrulamayı tekrar
        yapıyor.
      */}
      <JobLifecycleActions status={job.status} action={jobLifecycleAction.bind(null, id)} />
    </section>
  );
}
