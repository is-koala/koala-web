"use server";

import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";

import { readAddressWrite, writeFieldErrors } from "@/address/write";
import { employerBillingAddressPath } from "@/lib/app-routes";
import { idleAddressFormState, type AddressFormState } from "@/lib/form-state";
import { failureState, validationState } from "@/server/form";
import { updateCurrentUserAddress } from "@/server/address/user-address";

export type BillingAddressState = AddressFormState;

export const idleBillingAddressState: BillingAddressState = idleAddressFormState;

export async function saveBillingAddressAction(
  _state: BillingAddressState,
  formData: FormData,
): Promise<BillingAddressState> {
  void _state;
  const address = readAddressWrite(formData);
  if (address === null) {
    const invalid = validationState({ address: "Adresi onaylaman gerekiyor." });
    return invalid.status === "error" ? invalid : idleBillingAddressState;
  }

  try {
    const saved = await updateCurrentUserAddress(address);
    revalidatePath(employerBillingAddressPath);
    revalidatePath("/isveren");
    return { status: "done", address: saved };
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureState(error);
    if (failure.status !== "error") return idleBillingAddressState;
    return failure.fieldErrors
      ? { ...failure, fieldErrors: writeFieldErrors(failure.fieldErrors) }
      : failure;
  }
}
