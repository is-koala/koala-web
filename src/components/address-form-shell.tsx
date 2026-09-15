"use client";

import { useActionState } from "react";

import type { AddressGateway } from "@/address/gateway-client";
import { AddressView } from "@/components/address-view";
import { CanonicalAddressForm } from "@/components/canonical-address-form";
import { DoneNotice, SubmitButton } from "@/components/form-controls";
import { FormAlert } from "@/components/states";
import { idleAddressFormState, type ActionFor, type AddressFormState } from "@/lib/form-state";

/**
 * Adres formunun kabuğu.
 *
 * Üç ekranın farkı yalnız eylem, onay başlığı ve onayın altındaki içerik;
 * form gövdesi, üst bant, `address` alan hatası ve gönder düğmesi aynı.
 * Kabuk eylemi dışarıdan alıyor: sayfa şirket kimliği gibi bir bağlamı `bind`
 * ile bağlar, test sahte bir eylem geçirir.
 */
export function AddressFormShell({
  action,
  doneTitle,
  doneChildren,
  gateway,
}: {
  action: ActionFor<AddressFormState>;
  doneTitle: string;
  /** Onay kartında adresin altına çizilecek ek içerik (ör. dönüş bağlantısı). */
  doneChildren?: React.ReactNode;
  gateway?: AddressGateway;
}) {
  const [state, formAction] = useActionState(action, idleAddressFormState);

  if (state.status === "done") {
    return (
      <DoneNotice title={doneTitle}>
        <AddressView address={state.address} />
        {doneChildren}
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
