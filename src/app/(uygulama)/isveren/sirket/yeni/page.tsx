import type { Metadata } from "next";

import { CompanyForm } from "@/components/company/company-form";
import { EmployerGate } from "@/components/employer-gate";
import { currentGates } from "@/server/session/gates";

import { createCompanyAction } from "./actions";

export const metadata: Metadata = {
  title: "Yeni şirket",
  robots: { index: false, follow: false },
};

/**
 * Şirket oluşturma formu.
 *
 * Kapı `ShellGate` ile değil, `companyCreation` **kararıyla** okunuyor.
 * Kaydın bölümü `/isveren/sirket` ve o bölümün kimlik kapısı `advisory` —
 * kabuğun şeridi olarak duruyor ki davetle katılmış, kimliği doğrulanmamış
 * bir kullanıcı kendi şirketini görebilsin. Ama **oluşturma** eylemi
 * bambaşka: `CompanyManager.java:103-105` kimliği doğrulanmamış kullanıcıyı
 * kesin olarak reddediyor ve form tek kullanımlık bir adres kanıtı taşıyor
 * (`AddressSearchManager.verifyAndConsume`). Doldurulup reddedilen bir form,
 * kullanıcıya o kanıtı yeniden ürettirir.
 *
 * `EmployerGate` bu yüzden: engellendiğinde `children` hiç çizilmiyor,
 * yerine aynı adı taşıyan devre dışı bir düğme ve kapının kendi Türkçe
 * gerekçesi geçiyor.
 */
export default async function Page() {
  const { gates } = await currentGates();

  // Profil çözülemediyse kabuk zaten hata kartını çiziyor; bilinmeyen bir
  // durumu eksiklik gibi göstermek yanlış olurdu.
  if (gates === null) return null;

  const verdict = gates.companyCreation;
  const blocked = verdict.open ? [] : verdict.blockedBy;

  return (
    <section className="app-panel">
      <p className="eyebrow">İşveren</p>
      <h1>Yeni şirket</h1>
      <p className="lede">
        Şirketini kaydettiğinde onun yöneticisi olursun. Kayıt onay bekleyerek açılır ve
        onaylanana kadar şirket adına ilan açılamaz.
      </p>

      <EmployerGate blocked={blocked} action="Şirketi oluştur">
        <CompanyForm action={createCompanyAction} />
      </EmployerGate>
    </section>
  );
}
