"use server";

import { unstable_rethrow } from "next/navigation";

import type { PaymentResultCheck } from "@/components/payments/payment-result-wait";
import { isUuid } from "@/lib/identifiers";
import { failureView } from "@/server/form";
import { readPaymentReconciliation } from "@/server/payments/payments";
import { requireSessionForCurrentPath } from "@/server/session/guard";

export async function checkPaymentResultAction(
  assignmentId: string,
): Promise<PaymentResultCheck> {
  await requireSessionForCurrentPath();
  if (!isUuid(assignmentId)) {
    return { status: "error", errorCode: "PAYMENT_ASSIGNMENT_NOT_FOUND", httpStatus: 404 };
  }

  try {
    const reconciliation = await readPaymentReconciliation(assignmentId);
    if (reconciliation.assignment === null) {
      return { status: "error", errorCode: "PAYMENT_ASSIGNMENT_NOT_FOUND", httpStatus: 404 };
    }
    return reconciliation.resolution === "pending"
      ? { status: "pending" }
      : { status: "resolved" };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", ...failureView(error) };
  }
}
