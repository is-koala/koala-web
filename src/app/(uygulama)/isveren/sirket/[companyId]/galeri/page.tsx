import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { GalleryManager } from "@/components/gallery/gallery-manager";
import { ErrorState, LoadingState } from "@/components/states";
import { companyProfilePath } from "@/lib/app-routes";
import { canManageCompany } from "@/lib/company";
import { companyMembership } from "@/lib/company-contacts";
import { companyGalleryAdminNotice } from "@/lib/gallery";
import { listCompanyImages } from "@/server/gallery/gallery";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import { replaceCompanyGalleryAction, uploadCompanyGalleryAction } from "./actions";

export const metadata: Metadata = {
  title: "Şirket galerisi",
  robots: { index: false, follow: false },
};

/**
 * Şirket galerisi.
 *
 * **Bu klasörde `loading.tsx` yok ve olmamalı.** Sayfa `notFound()` çağırıyor
 * (`AGENTS.md`, "Yapı").
 *
 * `STAFF` 404 değil, yetki açıklaması görür: backend `requireCompanyAdmin`
 * 404 döndürür ama üyelik `GET /users/me`'den zaten belli — yazma uçlarını
 * çağırmadan önce gerekçeyi burada söylüyoruz.
 */
export default async function Page({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const { viewer } = await enterShell();
  if (viewer === null) return null;

  const membership = companyMembership(viewer.companies, companyId);
  if (membership === null) notFound();

  if (!canManageCompany(membership.role)) {
    return (
      <section className="app-panel">
        <p className="eyebrow">{membership.companyName}</p>
        <h1>Şirket galerisi</h1>
        <div className="state-card" role="status">
          <h2>Galeri için yönetici olmalısın</h2>
          <p>{companyGalleryAdminNotice}</p>
        </div>
        <Link className="text-link" href={companyProfilePath(membership.companyId)}>
          Şirket profiline dön
        </Link>
      </section>
    );
  }

  return (
    <Suspense fallback={<LoadingState label="Galeri yükleniyor…" />}>
      <CompanyGalleryPanel companyId={membership.companyId} companyName={membership.companyName} />
    </Suspense>
  );
}

export async function CompanyGalleryPanel({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  let images;
  try {
    images = await listCompanyImages(companyId);
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureView(error);
    return <ErrorState errorCode={failure.errorCode} status={failure.httpStatus} />;
  }

  return (
    <>
      <section className="app-panel">
        <p className="eyebrow">{companyName}</p>
        <h1>Şirket galerisi</h1>
        <p className="lede">
          Mekân fotoğraflarını bir kez yükleyip her ilanda yeniden seçebilirsin.
        </p>
        <Link className="text-link" href={companyProfilePath(companyId)}>
          Şirket profiline dön
        </Link>
      </section>
      <GalleryManager
        initialImages={images}
        uploadAction={uploadCompanyGalleryAction.bind(null, companyId)}
        replaceAction={replaceCompanyGalleryAction.bind(null, companyId)}
      />
    </>
  );
}
