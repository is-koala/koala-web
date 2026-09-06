import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";

import { PaymentResultWait } from "@/components/payments/payment-result-wait";
import { ErrorState } from "@/components/states";
import { paymentContent } from "@/content/account";
import { readSingleToken, type SearchValue } from "@/handoff/token";
import { isUuid } from "@/lib/identifiers";
import { failureView } from "@/server/form";
import { readPaymentReconciliation } from "@/server/payments/payments";
import { requireSessionForCurrentPath } from "@/server/session/guard";

import { checkPaymentResultAction } from "./actions";

export const metadata: Metadata = {
  title: "Ödeme Sonucu",
  robots: { index: false, follow: false },
};

type PaymentResultPageProps = {
  searchParams: Promise<{ status?: SearchValue; assignmentId?: SearchValue }>;
};

/**
 * Iyzico dönüşünün sabit yolu. Query yalnız dönüş biçimini doğrular; finansal
 * sonuç her zaman atama ve ödeme denemesi uçlarından yeniden okunur.
 */
export default async function Page({ searchParams }: PaymentResultPageProps) {
  const { status: statusValue, assignmentId: assignmentIdValue } = await searchParams;
  const assignmentId = readSingleToken(assignmentIdValue);
  const status = typeof statusValue === "string" ? statusValue : undefined;

  if (
    (status !== "success" && status !== "failed") ||
    !assignmentId.ok ||
    !isUuid(assignmentId.value)
  ) {
    return <InvalidPaymentReturn />;
  }

  await requireSessionForCurrentPath();

  const result = await readPaymentReconciliation(assignmentId.value)
    .then((reconciliation) => ({ reconciliation }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  if ("failure" in result) {
    return <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />;
  }
  if (result.reconciliation.assignment === null) return <InvalidPaymentReturn />;

  if (result.reconciliation.resolution !== "pending") {
    redirect(`/isveren/atama/${encodeURIComponent(assignmentId.value)}?paymentReturn=1`);
  }

  return (
    <PaymentResultWait
      assignmentId={assignmentId.value}
      check={checkPaymentResultAction.bind(null, assignmentId.value)}
    />
  );
}

function InvalidPaymentReturn() {
  return (
    <section className="account-card">
      <h1>{paymentContent.invalidTitle}</h1>
      <p className="lede">{paymentContent.invalidBody}</p>
    </section>
  );
}
