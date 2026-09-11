"use client";

import { useActionState } from "react";

import type { AddressGateway } from "@/address/gateway-client";
import { CanonicalAddressForm } from "@/components/canonical-address-form";
import { AddressView } from "@/components/address-view";
import { DoneNotice, FormAlert, SubmitButton } from "@/components/form-controls";

import {
  saveApplicantAddressAction,
  type ApplicantAddressState,
} from "./actions";

const idleApplicantAddressState: ApplicantAddressState = { status: "idle" };

export function ApplicantAddressForm({
  gateway,
}: {
  gateway?: AddressGateway;
}) {
  const [state, formAction] = useActionState(
    saveApplicantAddressAction,
    idleApplicantAddressState,
  );

  if (state.status === "done") {
    return (
      <DoneNotice title="Adresin kaydedildi">
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
