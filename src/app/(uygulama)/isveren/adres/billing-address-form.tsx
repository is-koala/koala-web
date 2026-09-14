"use client";

import type { AddressGateway } from "@/address/gateway-client";
import { AddressFormShell } from "@/components/address-form-shell";

import { saveBillingAddressAction } from "./actions";

export function BillingAddressForm({ gateway }: { gateway?: AddressGateway }) {
  return (
    <AddressFormShell
      action={saveBillingAddressAction}
      doneTitle="Fatura adresin kaydedildi"
      gateway={gateway}
    />
  );
}
