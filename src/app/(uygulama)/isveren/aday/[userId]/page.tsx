import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";

import { ApplicantDossierView } from "@/components/applicant-dossier";
import { ErrorState } from "@/components/states";
import { PageHeader, PagePanel } from "@/components/ui";
import { isUuid } from "@/lib/identifiers";
import { readApplicantDossier } from "@/server/applications/employer-review";
import { ApiError } from "@/server/api/errors";
import { notFoundStatus } from "@/server/contract";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

export const metadata: Metadata = {
  title: "Aday dosyası",
  robots: { index: false, follow: false },
};

/**
 * Bir adayın dosyası: profil, puan, rozetler, son değerlendirmeler.
 *
 * Başvuru kartı aynı dosyayı bir action ile kartın altına çiziyor
 * (`applicantDossierAction`); bu sayfa kartı olmayan iki yerin bağlantısı —
 * atamanın işçi kartı ve yetenek havuzu satırı (is-koala/koala-web#166).
 * Sunucu bileşeni: kabuğa yeni istemci kodu girmiyor.
 *
 * Kapısı yok: kimliği bilen işveren `GET /users/{id}` ve komşularını zaten
 * çağırabiliyor; backend olmayan kullanıcıya 404 veriyor ve web aynı cevabı
 * veriyor. Burada `loading.tsx` yok: sayfa `notFound()` çağırıyor ve bir
 * Suspense sınırı HTTP durumunu 200'de kilitlerdi (`AGENTS.md`).
 */
export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { viewer } = await enterShell();
  if (viewer === null) return null;

  const { userId } = await params;
  // Kimlik tarayıcıdan geliyor ve yola giriyor; UUID olmayan değer hiç sorulmaz.
  if (!isUuid(userId)) notFound();

  const result = await readApplicantDossier(userId)
    .then((dossier) => ({ dossier }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: error };
    });
  if ("failure" in result) {
    if (result.failure instanceof ApiError && result.failure.status === notFoundStatus) notFound();
    const failure = failureView(result.failure);
    return <ErrorState errorCode={failure.errorCode} status={failure.httpStatus} />;
  }

  return (
    <PagePanel className="applicant-dossier-panel">
      <PageHeader
        eyebrow="Aday dosyası"
        title={result.dossier.profile.fullName || "Adı paylaşılmadı"}
        lede={result.dossier.profile.occupation ?? undefined}
      />
      <ApplicantDossierView dossier={result.dossier} />
    </PagePanel>
  );
}
