"use client";

import { useActionState } from "react";

import type { AddressGateway } from "@/address/gateway-client";
import { CanonicalAddressForm } from "@/components/canonical-address-form";
import { AddressView } from "@/components/address-view";
import { DoneNotice, FormAlert, SubmitButton } from "@/components/form-controls";

import {
  idleBillingAddressState,
  saveBillingAddressAction,
} from "./actions";

export function BillingAddressForm({
  gateway,
}: {
  gateway?: AddressGateway;
}) {
  const [state, formAction] = useActionState(saveBillingAddressAction, idleBillingAddressState);

  if (state.status === "done") {
    return (
      <DoneNotice title="Fatura adresin kaydedildi">
        <AddressView address={state.address} />
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
