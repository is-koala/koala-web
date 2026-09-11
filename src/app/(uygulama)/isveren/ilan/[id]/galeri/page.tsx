import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { GalleryManager } from "@/components/gallery/gallery-manager";
import { ErrorState, LoadingState } from "@/components/states";
import { publishedJobPath } from "@/lib/app-routes";
import { isUuid } from "@/lib/identifiers";
import { ApiError } from "@/server/api/errors";
import { notFoundStatus } from "@/server/contract";
import { failureView } from "@/server/form";
import { listCompanyImages, listJobImages } from "@/server/gallery/gallery";
import { fetchJobDetail, type JobDetail } from "@/server/jobs/jobs";
import { enterShell } from "@/server/session/viewer";

import { replaceJobGalleryAction, uploadJobGalleryAction } from "./actions";

export const metadata: Metadata = {
  title: "İlan galerisi",
  robots: { index: false, follow: false },
};

/**
 * İlan galerisi.
 *
 * **Bu klasörde `loading.tsx` yok ve olmamalı.** Sayfa `notFound()` çağırıyor
 * (`AGENTS.md`, "Yapı"). Yükleniyor durumu kimlik ve 404 kararı verildikten
 * sonra açılan iç `Suspense` sınırında.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { viewer } = await enterShell();
  if (viewer === null) return null;

  const { id } = await params;
  if (!isUuid(id)) notFound();

  let job: JobDetail;
  try {
    job = await fetchJobDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === notFoundStatus) notFound();
    const failure = failureView(error);
    return <ErrorState errorCode={failure.errorCode} status={failure.httpStatus} />;
  }

  return (
    <Suspense fallback={<LoadingState label="Galeri yükleniyor…" />}>
      <JobGalleryPanel job={job} />
    </Suspense>
  );
}

export async function JobGalleryPanel({ job }: { job: JobDetail }) {
  let images;
  let companyImages = null;
  try {
    images = await listJobImages(job.id);
    if (job.companyId) companyImages = await listCompanyImages(job.companyId);
  } catch (error) {
    if (error instanceof ApiError && error.status === notFoundStatus) notFound();
    const failure = failureView(error);
    return <ErrorState errorCode={failure.errorCode} status={failure.httpStatus} />;
  }

  return (
    <>
      <section className="app-panel">
        <p className="eyebrow">İlan galerisi</p>
        <h1>{job.title}</h1>
        <p className="lede">Kapak görseli ilan kartlarında görünür. Sıra kaydedildikten sonra korunur.</p>
        <Link className="text-link" href={publishedJobPath(job.id)}>
          İlana dön
        </Link>
      </section>
      <GalleryManager
        initialImages={images}
        companyImages={companyImages}
        uploadAction={uploadJobGalleryAction.bind(null, job.id)}
        replaceAction={replaceJobGalleryAction.bind(null, job.id)}
      />
    </>
  );
}
