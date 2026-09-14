import Link from "next/link";

import { PageHeader, PagePanel } from "@/components/ui";
import { companyProfilePath, newCompanyPath } from "@/lib/app-routes";
import { contactRoleLabel } from "@/lib/company-contacts";
import type { ViewerCompany } from "@/server/session/viewer";

/**
 * Kullanıcının yetkilisi olduğu şirketler.
 *
 * Liste `GET /users/me` yanıtından geliyor: backend'de "şirketlerim" diye
 * ayrı bir uç yok ve kabuk bu yanıtı zaten okudu, yani ikinci bir tur
 * çıkmıyor.
 *
 * Onay durumu burada da yazılı, çünkü her üyeliğin kendi değeri var: iki
 * şirketten biri onaylı biri değilse tek bir rozet ikisi için de yanlış
 * olurdu.
 */
export function CompanyChooser({ companies }: { companies: readonly ViewerCompany[] }) {
  return (
    <PagePanel>
      <PageHeader
        eyebrow="İşveren"
        title="Şirketlerin"
        lede="Birden çok şirketin yetkilisisin. Devam etmek için hangi şirkette çalışacağını seç."
      />

      <ul className="profile-record-list" aria-label="Yetkilisi olduğun şirketler">
        {companies.map((company) => (
          <li key={company.companyId} className="profile-record">
            <div>
              <h2>
                <Link className="text-link" href={companyProfilePath(company.companyId)}>
                  {company.companyName}
                </Link>
              </h2>
              <small>
                {contactRoleLabel(company.role)} ·{" "}
                {company.approved ? "Onaylandı" : "Onay bekliyor"}
              </small>
            </div>
          </li>
        ))}
      </ul>

      <Link className="text-link" href={newCompanyPath}>
        Yeni şirket kur
      </Link>
    </PagePanel>
  );
}

/**
 * Hiç şirketi olmayan kullanıcının gördüğü giriş.
 *
 * Boş durum bir liste değil bir davet: kullanıcının buradan yapabileceği tek
 * iş şirket kurmak ve o yol ekranda yazılı olmazsa bölüm ölü görünür.
 */
export function NoCompanyPanel() {
  return (
    <PagePanel>
      <PageHeader
        eyebrow="İşveren"
        title="Henüz bir şirketin yok"
        lede="Şirket adına ilan açmak için önce şirketini kaydetmen gerekiyor. Kayıt onay bekleyerek açılır ve onaylanana kadar şirket adına ilan açılamaz."
      />
      <p className="muted">
        Bir şirkete yetkili olarak davet edildiysen daveti kabul ettiğinde şirket burada
        görünecek.
      </p>
      <Link className="button button-primary" href={newCompanyPath}>
        Şirket kur
      </Link>
    </PagePanel>
  );
}
