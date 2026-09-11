import type { Metadata } from "next";

import { AddressView } from "@/components/address-view";
import { currentUserAddress, enterShell } from "@/server/session/viewer";

import { BillingAddressForm } from "./billing-address-form";

export const metadata: Metadata = {
  title: "Fatura adresi",
  robots: { index: false, follow: false },
};

/**
 * Bireysel işverenin fatura adresi.
 *
 * `PUT /users/me/address` sözleşmesinin uçtan uca kanıtı (is-koala/koala-web#28).
 * Şirket ve ilan formları aynı kanonik bileşeni tüketir; burası onu kök
 * yazma ucuna bağlar. Kapı `ShellGate` değil: kayıtta bir bölüm değil, fatura
 * adresi eksiği kabuk şeridinden ve hesap ayarlarından buraya düşer.
 */
export default async function Page() {
  const { viewer } = await enterShell();
  if (viewer === null) return null;

  const address = await currentUserAddress();

  return (
    <section className="app-panel">
      <p className="eyebrow">İşveren</p>
      <h1>Fatura adresi</h1>
      <p className="lede">
        Ödemeyi başlatabilmek için kendi fatura adresine ihtiyacımız var. Harita
        yoksa konumu enlem ve boylamla da onaylayabilirsin.
      </p>
      {address && (
        <div className="address-current">
          <h2>Kayıtlı adres</h2>
          <AddressView address={address} />
        </div>
      )}
      <BillingAddressForm />
    </section>
  );
}
