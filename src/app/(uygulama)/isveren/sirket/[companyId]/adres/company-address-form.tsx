"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { AddressGateway } from "@/address/gateway-client";
import { AddressView } from "@/components/address-view";
import { CanonicalAddressForm } from "@/components/canonical-address-form";
import { DoneNotice, FormAlert, SubmitButton } from "@/components/form-controls";

import { idleCompanyAddressState, type CompanyAddressState } from "./state";

/**
 * Şirket adresi formu.
 *
 * Bireysel fatura adresi formuyla aynı kanonik bileşen (`src/address/*`,
 * is-koala/koala-web#28); farkı yalnız hedef uç ve bitişteki dönüş bağlantısı.
 * Eylem dışarıdan geliyor: sayfa şirket kimliğini `bind` ile bağlıyor ve
 * test sahte bir eylem geçirebiliyor.
 */
export function CompanyAddressForm({
  action,
  profileHref,
  gateway,
}: {
  action: (state: CompanyAddressState, formData: FormData) => Promise<CompanyAddressState>;
  profileHref: string;
  gateway?: AddressGateway;
}) {
  const [state, formAction] = useActionState(action, idleCompanyAddressState);

  if (state.status === "done") {
    return (
      <DoneNotice title="Şirket adresi kaydedildi">
        <AddressView address={state.address} />
        {/* Sayfa başlığında aynı hedefe "Şirket profiline dön" zaten var;
            aynı adla ikinci bağlantı ekran okuyucuya çift madde okuturdu. */}
        <Link className="text-link" href={profileHref}>
          Yeni adresi profilde gör
        </Link>
      </DoneNotice>
    );
  }

  return (
    <form action={formAction} noValidate className="job-form">
      <FormAlert state={state} />
      <CanonicalAddressForm
        gateway={gateway}
        fieldErrors={state.status === "error" ? state.fieldErrors : undefined}
      />
      {state.status === "error" && state.fieldErrors?.address ? (
        <p className="field-error">{state.fieldErrors.address}</p>
      ) : null}
      <SubmitButton label="Adresi kaydet" pendingLabel="Kaydediliyor" />
    </form>
  );
}
