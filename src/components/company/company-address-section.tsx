import Link from "next/link";

import type { CanonicalAddress } from "@/address/contract";
import { AddressView } from "@/components/address-view";
import { AnchorReveal } from "@/components/anchor-reveal";
import { companyAddressAnchor } from "@/lib/app-routes";

/**
 * "Şirket adresi" bölümü; profil ve düzenleme ekranı aynı bölümü çiziyor.
 *
 * Ödeme buradaki adresi okuyor (`JobAssignmentManager`), kullanıcının kendi
 * adresini değil; adres eksikse ödeme kapısı `#sirket-adresi` çapasına
 * yolluyor ve eksiğin neden burada kapandığı yazılı olmalı.
 *
 * `editHref` yalnız `ADMIN` için verilir: `PATCH /companies/{id}`
 * `requireCompanyAdmin` istiyor ve geçemeyene 404 dönüyor; CONTACT salt okur.
 */
export function CompanyAddressSection({
  address,
  editHref,
}: {
  address: CanonicalAddress | null;
  editHref: string | null;
}) {
  return (
    <section className="app-panel" id={companyAddressAnchor} aria-labelledby="company-address-title">
      {/* Bölüm `Suspense` arkasından geliyor; ödeme kapısının çapası aksi
          hâlde sayfanın tepesinde kalırdı. */}
      <AnchorReveal id={companyAddressAnchor} />
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Adres</p>
          <h2 id="company-address-title">Şirket adresi</h2>
        </div>
        {editHref ? (
          <Link className="text-link" href={editHref}>
            Düzenle
          </Link>
        ) : null}
      </div>
      <AddressView address={address} />
      <p className="muted">
        Şirket ilanlarının faturası bu adrese kesilir; adres yoksa ödeme başlatılamaz. Adresi
        yalnız şirket yöneticisi değiştirebilir.
      </p>
    </section>
  );
}
