"use server";

import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";

import { readAddressWrite, writeFieldErrors } from "@/address/write";
import { workerApplicantAddressPath } from "@/lib/app-routes";
import type { AddressFormState } from "@/lib/form-state";
import { failureState, validationState } from "@/server/form";
import { updateCurrentUserAddress } from "@/server/address/user-address";

export type ApplicantAddressState = AddressFormState;

export async function saveApplicantAddressAction(
  _state: ApplicantAddressState,
  formData: FormData,
): Promise<ApplicantAddressState> {
  void _state;
  const address = readAddressWrite(formData);
  if (address === null) {
    const invalid = validationState({ address: "Adresi onaylaman gerekiyor." });
    return invalid.status === "error" ? invalid : { status: "idle" };
  }

  try {
    const saved = await updateCurrentUserAddress(address);
    revalidatePath(workerApplicantAddressPath);
    revalidatePath("/panel");
    return { status: "done", address: saved };
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureState(error);
    if (failure.status !== "error") return { status: "idle" };
    return failure.fieldErrors
      ? { ...failure, fieldErrors: writeFieldErrors(failure.fieldErrors) }
      : failure;
  }
}
