import "server-only";

import { isUuid } from "@/lib/identifiers";
import { failureView } from "@/server/form";
import { readSession } from "@/server/session/session";

import { readPaymentReconciliation } from "./payments";

export type PaymentResultPollBody =
  | { status: "pending" }
  | { status: "resolved" }
  | { status: "error"; errorCode: string; httpStatus: number };

export async function readPaymentResultPoll(
  assignmentId: string,
): Promise<{ status: number; body: PaymentResultPollBody }> {
  if (!isUuid(assignmentId)) return notFoundResult;

  const session = await readSession();
  if (!session.refreshToken) {
    return { status: 401, body: { status: "error", errorCode: "AUTHENTICATION_REQUIRED", httpStatus: 401 } };
  }

  try {
    const reconciliation = await readPaymentReconciliation(assignmentId);
    if (reconciliation.assignment === null) return notFoundResult;
    return {
      status: 200,
      body: { status: reconciliation.resolution === "pending" ? "pending" : "resolved" },
    };
  } catch (error) {
    const failure = failureView(error);
    return { status: failure.httpStatus || 500, body: { status: "error", ...failure } };
  }
}

const notFoundResult = {
  status: 404,
  body: { status: "error", errorCode: "PAYMENT_ASSIGNMENT_NOT_FOUND", httpStatus: 404 },
} as const;
