import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { ShellGate } from "@/app/(uygulama)/shell";
import { PaymentHistory } from "@/components/payments/employer-payment";
import { ErrorState, LoadingState } from "@/components/states";
import { isUuid } from "@/lib/identifiers";
import { failureView } from "@/server/form";
import { readPaymentReconciliation } from "@/server/payments/payments";
import { enterShell } from "@/server/session/viewer";

type PaymentHistoryPageProps = { params: Promise<{ assignmentId: string }> };

export default function Page({ params }: PaymentHistoryPageProps) {
  return (
    <ShellGate shell="employer" href="/isveren/atamalar">
      <Suspense fallback={<LoadingState label="Ödeme denemeleri yükleniyor" />}>
        <PaymentHistoryPage params={params} />
      </Suspense>
    </ShellGate>
  );
}

export async function PaymentHistoryPage({ params }: PaymentHistoryPageProps) {
  const context = await enterShell();
  if (context.failure !== null || context.viewer === null) return null;

  const { assignmentId } = await params;
  if (!isUuid(assignmentId)) notFound();

  const result = await readPaymentReconciliation(assignmentId)
    .then((reconciliation) => ({ reconciliation }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });
  if ("failure" in result) {
    return <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />;
  }
  if (result.reconciliation.assignment === null) notFound();

  return (
    <section className="app-panel payment-history-page">
      <p className="eyebrow">Ödeme geçmişi</p>
      <h1>{result.reconciliation.assignment.title}</h1>
      <p className="lede">Her ödeme girişimi ayrı kayıt olarak ve en yeni deneme önce görünür.</p>
      <PaymentHistory attempts={result.reconciliation.attempts} />
      <Link className="text-link" href={`/isveren/atama/${encodeURIComponent(assignmentId)}`}>
        Atama ayrıntısına dön
      </Link>
    </section>
  );
}
