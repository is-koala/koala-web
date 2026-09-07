import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CompanyProfileView } from "@/components/company/company-profile";
import { ErrorState, LoadingState } from "@/components/states";
import { editCompanyPath, newCompanyJobPath } from "@/lib/app-routes";
import { companyMembership } from "@/lib/company-contacts";
import { getCompany, type Company } from "@/server/company/company";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import { contactsPath } from "./yetkililer/paths";

export const metadata: Metadata = {
  title: "Şirket profili",
  robots: { index: false, follow: false },
};

/**
 * Bir şirketin profili.
 *
 * **Bu klasörde `loading.tsx` yok ve olmamalı.** Sayfa `notFound()`
 * çağırıyor; segment bir `loading.tsx` ile sarıldığında kabuk render'ın
 * başında akıtılır, HTTP durumu 200'de kilitlenir ve üyesi olunmayan bir
 * şirket 404 yerine 200 dönerdi. Yükleniyor durumu bu yüzden sayfanın
 * **içinde**, üyelik kararı verildikten sonra açılan bir `Suspense`
 * sınırında duruyor (`AGENTS.md`, "Yapı").
 */
export default async function Page({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const { viewer } = await enterShell();

  if (viewer === null) return null;

  /*
   * Üyelik kullanıcının kendi `GET /users/me` yanıtından okunuyor — kabuk onu
   * zaten çekti ve `React.cache()` ile paylaşıyor.
   *
   * Bu denetim burada **zorunlu**: `GET /companies/{companyId}` üyeliğe hiç
   * bakmıyor (`CompanyManager.java:267-273`), yani oturumu olan herkes vergi
   * numarası, e-posta ve tam adres dahil bütün `CompanyDto`'yu okuyabiliyor.
   * Sayfa kimliği bilen herkese açık olsaydı bu boşluk ürüne taşınırdı.
   *
   * Üyeliği olmayan **404** görüyor, "bu şirketin yetkilisi değilsin" değil:
   * "var ama senin değil" demek, sözleşmenin kapattığı varlık bilgisini geri
   * açardı. Biçimi bozuk bir kimlik de aynı yolu izler — hiçbir üyelikle
   * eşleşmez.
   */
  const membership = companyMembership(viewer.companies, companyId);
  if (membership === null) notFound();

  return (
    <Suspense fallback={<LoadingState label="Şirket bilgileri yükleniyor…" />}>
      <CompanyPanel companyId={membership.companyId} viewerRole={membership.role} />
    </Suspense>
  );
}

async function CompanyPanel({
  companyId,
  viewerRole,
}: {
  companyId: string;
  viewerRole: string;
}) {
  let company: Company;
  try {
    company = await getCompany(companyId);
  } catch (error) {
    const { errorCode, httpStatus } = failureView(error);
    return <ErrorState errorCode={errorCode} status={httpStatus} />;
  }

  return (
    <CompanyProfileView
      company={company}
      viewerRole={viewerRole}
      editHref={editCompanyPath(companyId)}
      contactsHref={contactsPath(companyId)}
      newJobHref={newCompanyJobPath(companyId)}
    />
  );
}
