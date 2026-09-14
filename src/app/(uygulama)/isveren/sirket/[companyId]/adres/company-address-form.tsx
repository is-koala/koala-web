"use client";

import Link from "next/link";

import type { AddressGateway } from "@/address/gateway-client";
import { AddressFormShell } from "@/components/address-form-shell";
import type { ActionFor, AddressFormState } from "@/lib/form-state";

/**
 * Şirket adresi formu: bireysel fatura adresiyle aynı kabuk
 * (`AddressFormShell`), farkı yalnız hedef uç ve onaydaki dönüş bağlantısı.
 */
export function CompanyAddressForm({
  action,
  profileHref,
  gateway,
}: {
  action: ActionFor<AddressFormState>;
  profileHref: string;
  gateway?: AddressGateway;
}) {
  return (
    <AddressFormShell
      action={action}
      doneTitle="Şirket adresi kaydedildi"
      gateway={gateway}
      doneChildren={
        /* Sayfa başlığında aynı hedefe "Şirket profiline dön" zaten var;
           aynı adla ikinci bağlantı ekran okuyucuya çift madde okuturdu. */
        <Link className="text-link" href={profileHref}>
          Yeni adresi profilde gör
        </Link>
      }
    />
  );
}
