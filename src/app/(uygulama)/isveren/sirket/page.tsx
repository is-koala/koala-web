import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CompanyChooser, NoCompanyPanel } from "@/components/company/company-chooser";
import { companyAddressAnchor, companyProfilePath, companySectionFocusParam } from "@/lib/app-routes";
import { companySectionDestination } from "@/lib/company";
import { enterShell } from "@/server/session/viewer";

export const metadata: Metadata = {
  title: "Şirketim",
  robots: { index: false, follow: false },
};

/**
 * Şirket bölümünün girişi.
 *
 * **Bu klasörde `loading.tsx` yok ve olmamalı.** Sayfa tek şirketli
 * kullanıcıyı `redirect()` ile profile bırakıyor; segment bir Suspense
 * sınırıyla sarıldığında kabuk render'ın başında akıtılır, HTTP durumu
 * 200'de kilitlenir ve yönlendirme artık yapılamaz (`AGENTS.md`, "Yapı").
 * Zaten bekletecek bir çağrı da yok: karar kabuğun okuduğu `GET /users/me`
 * yanıtından çıkıyor ve `React.cache()` ile paylaşılıyor.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ viewer }, params] = await Promise.all([enterShell(), searchParams]);

  // Profil çözülemediyse kabuk zaten nedenini yazan hata kartını çiziyor;
  // burada ikinci bir mesaj göstermek onu tekrarlardı.
  if (viewer === null) return null;

  const destination = companySectionDestination(viewer.companies);

  if (destination.kind === "single") {
    // Ödeme kapısı `?bolum=sirket-adresi` ile gelir; çapa yönlendirme
    // hedefine burada eklenir çünkü istemci yönlendirmesi parçayı taşımıyor.
    const focus = params[companySectionFocusParam] === companyAddressAnchor ? `#${companyAddressAnchor}` : "";
    redirect(`${companyProfilePath(destination.companyId)}${focus}`);
  }

  if (destination.kind === "create") return <NoCompanyPanel />;

  return <CompanyChooser companies={viewer.companies} />;
}
