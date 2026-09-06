"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/form-controls";
import { ErrorState } from "@/components/states";
import type { CheckoutActionState } from "@/app/(uygulama)/isveren/atama/[assignmentId]/odeme/actions";

export type CheckoutAction = (
  state: CheckoutActionState,
  formData: FormData,
) => Promise<CheckoutActionState>;

export function CheckoutButton({ action }: { action: CheckoutAction }) {
  const [state, formAction] = useActionState(action, { status: "idle" });

  return (
    <form action={formAction} className="checkout-submit">
      {state.status === "error" ? (
        <ErrorState errorCode={state.errorCode} status={state.httpStatus} />
      ) : null}
      <SubmitButton label="Iyzico ile güvenli öde" pendingLabel="Ödeme sayfası hazırlanıyor" />
    </form>
  );
}
