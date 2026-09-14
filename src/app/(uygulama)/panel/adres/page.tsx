import type { Metadata } from "next";

import { AddressView } from "@/components/address-view";
import { PageHeader, PagePanel } from "@/components/ui";
import { currentUserAddress, enterShell } from "@/server/session/viewer";

import { ApplicantAddressForm } from "./applicant-address-form";

export const metadata: Metadata = {
  title: "Adresin",
  robots: { index: false, follow: false },
};

/**
 * İş arayanın başvuru adresi.
 *
 * `PUT /users/me/address` aynı uç #28 fatura adresinde; burası onu iş arayan
 * kabuğuna bağlar (is-koala/koala-web#133). Kapı `ShellGate` değil: kayıtta
 * bir bölüm değil, başvuru reddi `APPLICANT_ADDRESS_REQUIRED` buraya düşer.
 */
export default async function Page() {
  const { viewer } = await enterShell();
  if (viewer === null) return null;

  const address = await currentUserAddress();

  return (
    <PagePanel>
      <PageHeader
        eyebrow="Panel"
        title="Adresin"
        lede="Başvuru yapabilmek için hesabına bir adres eklemen gerekiyor. Harita yoksa konumu enlem ve boylamla da onaylayabilirsin."
      />
      {address && (
        <div className="address-current">
          <h2>Kayıtlı adres</h2>
          <AddressView address={address} />
        </div>
      )}
      <ApplicantAddressForm />
    </PagePanel>
  );
}
