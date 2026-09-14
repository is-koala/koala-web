import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { ShellGate } from "@/app/(uygulama)/shell";
import {
  DisputeEscrowNotice,
  PaymentHistory,
} from "@/components/payments/employer-payment";
import { ErrorState, LoadingState } from "@/components/states";
import { PageHeader, PagePanel } from "@/components/ui";
import { isUuid } from "@/lib/identifiers";
import type { EmployerAssignment } from "@/payments/contract";
import { failureView } from "@/server/form";
import {
  readEmployerAssignment,
  readPaymentDetailsForAssignment,
} from "@/server/payments/payments";
import { enterShell } from "@/server/session/viewer";

type PaymentHistoryPageProps = { params: Promise<{ assignmentId: string }> };

export default function Page({ params }: PaymentHistoryPageProps) {
  return (
    <ShellGate shell="employer" href="/isveren/atamalar">
      <PaymentHistoryPage params={params} />
    </ShellGate>
  );
}

export async function PaymentHistoryPage({ params }: PaymentHistoryPageProps) {
  const context = await enterShell();
  if (context.failure !== null || context.viewer === null) return null;

  const { assignmentId } = await params;
  if (!isUuid(assignmentId)) notFound();

  const result = await readEmployerAssignment(assignmentId)
    .then((assignment) => ({ assignment }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });
  if ("failure" in result) {
    return <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />;
  }
  if (result.assignment === null) notFound();

  return (
    <Suspense fallback={<LoadingState label="Ödeme denemeleri yükleniyor" />}>
      <PaymentHistoryContent assignment={result.assignment} />
    </Suspense>
  );
}

export async function PaymentHistoryContent({ assignment }: { assignment: EmployerAssignment }) {
  const result = await readPaymentDetailsForAssignment(assignment)
    .then((reconciliation) => ({ reconciliation }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });
  if ("failure" in result) {
    return <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />;
  }

  return (
    <PagePanel className="payment-history-page">
      <PageHeader
        eyebrow="Ödeme geçmişi"
        title={assignment.title}
        lede="Her ödeme girişimi ayrı kayıt olarak ve en yeni deneme önce görünür."
      />
      <DisputeEscrowNotice hasActiveDispute={result.reconciliation.hasActiveDispute} />
      <PaymentHistory attempts={result.reconciliation.attempts} />
      <Link className="text-link" href={`/isveren/atama/${encodeURIComponent(assignment.id)}`}>
        Atama ayrıntısına dön
      </Link>
    </PagePanel>
  );
}
