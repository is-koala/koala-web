import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { serviceAreaNotice } from "@/address/contract";
import { AddressView } from "@/components/address-view";
import { ErrorState, LoadingState } from "@/components/states";
import { companyProfilePath } from "@/lib/app-routes";
import { canManageCompany } from "@/lib/company";
import { companyMembership } from "@/lib/company-contacts";
import { getCompany, type Company } from "@/server/company/company";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import { saveCompanyAddressAction } from "./actions";
import { CompanyAddressForm } from "./company-address-form";

export const metadata: Metadata = {
  title: "Şirket adresini düzenle",
  robots: { index: false, follow: false },
};

/**
 * Şirket adresinin düzenleme ekranı (is-koala/koala-web#172).
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
   * Üyeliği olmayan da, `CONTACT` da aynı 404'ü görüyor: `PATCH
   * /companies/{companyId}` `requireCompanyAdmin` istiyor ve geçemeyene
   * `USER_NOT_ASSOCIATED_WITH_COMPANY` ile 404 dönüyor. Ekranın "yetkin yok"
   * demesi backend'in bilerek ayırt edilemez bıraktığı iki durumu ayırırdı.
   * Adresi salt okumak isteyen yetkili onu profilde zaten görüyor.
   */
  if (membership === null || !canManageCompany(membership.role)) notFound();

  return (
    <Suspense fallback={<LoadingState label="Şirket adresi yükleniyor…" />}>
      <AddressPanel companyId={membership.companyId} />
    </Suspense>
  );
}

export async function AddressPanel({ companyId }: { companyId: string }) {
  let company: Company;
  try {
    company = await getCompany(companyId);
  } catch (error) {
    unstable_rethrow(error);
    const { errorCode, httpStatus } = failureView(error);
    return <ErrorState errorCode={errorCode} status={httpStatus} />;
  }

  const profileHref = companyProfilePath(companyId);

  return (
    <div className="profile-page">
      <section className="app-panel profile-heading">
        <div>
          <p className="eyebrow">{company.name}</p>
          <h1>Şirket adresini düzenle</h1>
        </div>
        <Link className="text-link" href={profileHref}>
          Şirket profiline dön
        </Link>
      </section>

      <section className="app-panel" aria-labelledby="company-address-current-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Kayıtlı adres</p>
            <h2 id="company-address-current-title">Şu anki şirket adresi</h2>
          </div>
        </div>
        <AddressView address={company.address} />
      </section>

      <section className="app-panel" aria-labelledby="company-address-form-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Yeni adres</p>
            <h2 id="company-address-form-title">Adresi değiştir</h2>
          </div>
        </div>
        <p className="lede">
          Şirket ilanlarının faturası bu adrese kesilir. Harita yoksa konumu enlem ve boylamla da
          onaylayabilirsin.
        </p>
        {/*
          Hizmet alanı gönderimden **önce** yazılı: backend sınır dışındaki
          konumu 400 ile reddediyor ve kullanıcı o an formu çoktan doldurmuş
          oluyor.
        */}
        <p className="field-hint">{serviceAreaNotice}</p>
        <CompanyAddressForm
          action={saveCompanyAddressAction.bind(null, companyId)}
          profileHref={profileHref}
        />
      </section>
    </div>
  );
}
