"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import { isUuid } from "@/lib/identifiers";
import { hasUnresolvedPaymentAttempt, isAllowedPaymentPageUrl } from "@/payments/checkout";
import { createPaymentSession, readPaymentAttempts } from "@/server/payments/payments";
import { failureView } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";

export type CheckoutActionState =
  | { status: "idle" }
  | { status: "error"; errorCode: string; httpStatus: number };

export async function startPaymentAction(
  assignmentId: string,
  _state: CheckoutActionState,
  _formData: FormData,
): Promise<CheckoutActionState> {
  void _state;
  void _formData;
  await requireSessionForCurrentPath();

  if (!isUuid(assignmentId)) {
    return { status: "error", errorCode: "PAYMENT_ASSIGNMENT_NOT_FOUND", httpStatus: 404 };
  }

  let paymentPageUrl: string;
  try {
    const attempts = await readPaymentAttempts(assignmentId);
    if (hasUnresolvedPaymentAttempt(attempts)) {
      return {
        status: "error",
        errorCode: "PAYMENT_ATTEMPT_IN_PROGRESS",
        httpStatus: 409,
      };
    }
    const session = await createPaymentSession(assignmentId);
    paymentPageUrl = session.paymentPageUrl;
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", ...failureView(error) };
  }

  if (!isAllowedPaymentPageUrl(paymentPageUrl)) {
    return { status: "error", errorCode: "PAYMENT_PAGE_URL_REJECTED", httpStatus: 502 };
  }

  redirect(paymentPageUrl);
}
