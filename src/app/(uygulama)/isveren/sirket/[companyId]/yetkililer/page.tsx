import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import {
  CompanyContactsPageView,
  type CompanyContactsData,
} from "@/components/company-contacts-page";
import { LoadingState } from "@/components/states";
import { canManageContacts, companyMembership } from "@/lib/company-contacts";
import { getCompanyContacts, getCompanyInvitations } from "@/server/company/contacts";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import { removeContactAction } from "./actions";

export const metadata: Metadata = {
  title: "Şirket yetkilileri",
  robots: { index: false, follow: false },
};

/**
 * Şirketin yetkili listesi ve bekleyen davetleri.
 *
 * **Bu klasörde `loading.tsx` yok ve olmamalı.** Sayfa `notFound()`
 * çağırıyor; segment bir `loading.tsx` ile sarıldığında kabuk render'ın
 * başında akıtılır, HTTP durumu 200'de kilitlenir ve üyesi olunmayan bir
 * şirket 404 yerine 200 dönerdi. Yükleniyor durumu bu yüzden sayfanın
 * **içinde**, üyelik kararı verildikten sonra açılan bir `Suspense`
 * sınırında duruyor (`AGENTS.md`, "Yapı").
 *
 * Bölüm `app-routes.ts` kaydında yok, bilerek: kayıt sabit adreslerle
 * çalışıyor ve bu adres bir `companyId` taşıyor. Bölümün hesap düzeyinde bir
 * kapısı da yok — davet ve çıkarma ne kimlik doğrulaması ne işveren rolü
 * istiyor (`CompanyManager.requireCompanyAdmin` yalnız üyeliğe bakıyor).
 * Tek ön koşul şirkete özgü üyelik ve onun cevabı aşağıda: `notFound()`.
 */
export default async function Page({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const { viewer } = await enterShell();

  // Profil çözülemediyse kabuk zaten nedenini yazan hata kartını çiziyor;
  // burada ikinci bir mesaj göstermek onu tekrarlardı.
  if (viewer === null) return null;

  /*
   * Üyelik kullanıcının kendi `GET /users/me` yanıtından okunuyor — kabuk onu
   * zaten çekti ve `React.cache()` ile paylaşıyor, yani ikinci bir tur yok.
   *
   * Üyeliği olmayan kullanıcı **404** görüyor, "bu şirketin yetkilisi
   * değilsin" değil. Backend'in dört davet ucu da üyesi olunmayan şirketi var
   * olmayan şirketten `errorCode` dahil ayırt edilemez bırakıyor
   * (is-koala/koala-backend#85); istemci "var ama senin değil" diyebilseydi
   * sözleşmenin kapattığı varlık bilgisi ekrandan sızardı. Biçimi bozuk bir
   * kimlik de aynı yolu izler: hiçbir üyelikle eşleşmez.
   */
  const membership = companyMembership(viewer.companies, companyId);
  if (membership === null) notFound();

  return (
    <Suspense fallback={<LoadingState label="Şirket yetkilileri yükleniyor…" />}>
      <ContactsPanel
        companyId={membership.companyId}
        companyName={membership.companyName}
        viewerRole={membership.role}
      />
    </Suspense>
  );
}

export async function ContactsPanel({
  companyId,
  companyName,
  viewerRole,
}: {
  companyId: string;
  companyName: string;
  viewerRole: string;
}) {
  /*
   * Davet listesi yalnız yönetici için çekiliyor. `STAFF` için uç kesin 404
   * döndürüyor; o isteği yapıp yanıtını hata kartına çevirmek, kullanıcının
   * kendi rolünden bilinen bir sonucu arıza gibi gösterirdi.
   */
  const [contacts, invitations] = await Promise.all([
    resolve(getCompanyContacts(companyId)),
    canManageContacts(viewerRole) ? resolve(getCompanyInvitations(companyId)) : null,
  ]);

  return (
    <CompanyContactsPageView
      companyName={companyName}
      viewerRole={viewerRole}
      contacts={contacts}
      invitations={invitations}
      removeAction={(userId) => removeContactAction.bind(null, companyId, userId)}
    />
  );
}

/**
 * İki liste birbirinden bağımsız düşebiliyor: davet ucu kapalıyken de yetkili
 * listesi okunabilir olmalı, yoksa tek bir arıza ekranın tamamını götürür.
 */
async function resolve<T>(request: Promise<T>): Promise<CompanyContactsData<T>> {
  try {
    return { status: "ready", data: await request };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", ...failureView(error) };
  }
}
