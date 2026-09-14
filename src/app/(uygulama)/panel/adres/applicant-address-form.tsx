"use client";

import type { AddressGateway } from "@/address/gateway-client";
import { AddressFormShell } from "@/components/address-form-shell";

import { saveApplicantAddressAction } from "./actions";

export function ApplicantAddressForm({ gateway }: { gateway?: AddressGateway }) {
  return (
    <AddressFormShell
      action={saveApplicantAddressAction}
      doneTitle="Adresin kaydedildi"
      gateway={gateway}
    />
  );
}
