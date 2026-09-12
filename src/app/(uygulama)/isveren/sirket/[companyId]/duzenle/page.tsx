import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { AddressView } from "@/components/address-view";
import { CompanyEditForm } from "@/components/company/company-edit-form";
import { CompanyLogoForms } from "@/components/company/company-logo-forms";
import { ErrorState, LoadingState } from "@/components/states";
import { companyProfilePath } from "@/lib/app-routes";
import { canManageCompany, companyTypeLabel, lockedCompanyFields } from "@/lib/company";
import { companyMembership } from "@/lib/company-contacts";
import { getCompany, type Company } from "@/server/company/company";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import {
  removeCompanyLogoAction,
  replaceCompanyLogoAction,
  updateCompanyAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Şirket bilgilerini düzenle",
  robots: { index: false, follow: false },
};

/**
 * Şirketin düzenleme ekranı.
 *
 * **Bu klasörde `loading.tsx` yok ve olmamalı** — sayfa `notFound()`
 * çağırıyor (`AGENTS.md`, "Yapı"). Yükleniyor durumu üyelik ve rol kararı
 * verildikten sonra açılan iç `Suspense` sınırında.
 */
export default async function Page({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const { viewer } = await enterShell();

  if (viewer === null) return null;

  const membership = companyMembership(viewer.companies, companyId);

  /*
   * Üyeliği olmayan da, `STAFF` de aynı 404'ü görüyor.
   *
   * `PATCH /companies/{companyId}` ve iki logo ucu `requireCompanyAdmin`
   * istiyor ve geçemeyen çağrıya `ResourceNotFoundException` dönüyor: ekranın
   * "yetkin yok" demesi, backend'in bilerek ayırt edilemez bıraktığı iki
   * durumu ayırırdı.
   */
  if (membership === null || !canManageCompany(membership.role)) notFound();

  return (
    <Suspense fallback={<LoadingState label="Şirket bilgileri yükleniyor…" />}>
      <EditPanel companyId={membership.companyId} />
    </Suspense>
  );
}

export async function EditPanel({ companyId }: { companyId: string }) {
  let company: Company;
  try {
    company = await getCompany(companyId);
  } catch (error) {
    unstable_rethrow(error);
    const { errorCode, httpStatus } = failureView(error);
    return <ErrorState errorCode={errorCode} status={httpStatus} />;
  }

  return (
    <div className="profile-page">
      <section className="app-panel profile-heading">
        <div>
          <p className="eyebrow">{company.name}</p>
          <h1>Şirket bilgilerini düzenle</h1>
        </div>
        <Link className="text-link" href={companyProfilePath(companyId)}>
          Şirket profiline dön
        </Link>
      </section>

      <section className="app-panel" aria-labelledby="company-edit-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Düzenlenebilir</p>
            <h2 id="company-edit-title">Şirket bilgileri</h2>
          </div>
        </div>
        <CompanyEditForm
          company={company}
          action={updateCompanyAction.bind(null, companyId)}
        />
      </section>

      <section className="app-panel" aria-labelledby="company-logo-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Logo</p>
            <h2 id="company-logo-title">Şirket logosu</h2>
          </div>
        </div>
        <p className="lede">
          Logo kendi eylemine bağlı: yüklemek ya da kaldırmak için şirket bilgilerini yeniden
          kaydetmen gerekmiyor.
        </p>
        <CompanyLogoForms
          company={company}
          replaceAction={replaceCompanyLogoAction.bind(null, companyId)}
          removeAction={removeCompanyLogoAction.bind(null, companyId)}
        />
      </section>

      <LockedFields company={company} />
    </div>
  );
}

/**
 * Değiştirilemeyen alanlar.
 *
 * Salt okunur gösteriliyor ve her birinin **nedeni** yanında: alanı tümden
 * gizlemek "vergi numaramı nereden değiştiririm" sorusunu cevapsız
 * bırakırdı, düzenlenebilir gibi göstermek ise backend'in sessizce yok
 * sayacağı bir yazma üretirdi.
 */
function LockedFields({ company }: { company: Company }) {
  const values: Record<string, string | null> = {
    taxNumber: company.taxNumber,
    type: companyTypeLabel(company.type),
    address: null,
  };

  return (
    <section className="app-panel" aria-labelledby="company-locked-title">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Değiştirilemez</p>
          <h2 id="company-locked-title">Kayıtla birlikte sabitlenen bilgiler</h2>
        </div>
      </div>

      <dl className="job-facts locked-fields">
        {lockedCompanyFields.map((field) => (
          <div key={field.name}>
            <dt>{field.label}</dt>
            <dd>
              {field.name === "address" ? (
                <AddressView address={company.address} />
              ) : (
                values[field.name]
              )}
              <p className="field-hint">{field.reason}</p>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
