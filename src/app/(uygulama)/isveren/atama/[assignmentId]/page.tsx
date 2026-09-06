import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { ShellGate } from "@/app/(uygulama)/shell";
import {
  EmployerAssignmentPayment,
  PaymentBreakdown,
  PaymentResultNotice,
} from "@/components/payments/employer-payment";
import { ErrorState, LoadingState } from "@/components/states";
import { formatAssignmentDate } from "@/components/assignment-presenters";
import { isUuid } from "@/lib/identifiers";
import { failureView } from "@/server/form";
import { readPaymentReconciliation } from "@/server/payments/payments";
import { viewerGates } from "@/server/session/gates";
import { enterShell } from "@/server/session/viewer";

type EmployerAssignmentPageProps = {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ paymentReturn?: string | string[]; status?: string | string[] }>;
};

export default function Page(props: EmployerAssignmentPageProps) {
  return (
    <ShellGate shell="employer" href="/isveren/atamalar">
      <Suspense fallback={<LoadingState label="Atama ayrıntısı yükleniyor" />}>
        <EmployerAssignmentPage {...props} />
      </Suspense>
    </ShellGate>
  );
}

export async function EmployerAssignmentPage({ params, searchParams }: EmployerAssignmentPageProps) {
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
  const { assignment, resolution } = result.reconciliation;
  if (assignment === null) notFound();

  const paymentGate = viewerGates(context.viewer).individualPayment;
  const blocked = assignment.employerType === "INDIVIDUAL" && !paymentGate.open
    ? paymentGate.blockedBy
    : [];
  const query = await searchParams;
  const showPaymentResult = query.paymentReturn === "1";

  return (
    <section className="app-panel employer-assignment-detail">
      <p className="eyebrow">İşveren ataması</p>
      <h1>{assignment.title}</h1>
      <p className="lede">{assignment.workerName || "İşçi bilgisi bekleniyor"}</p>

      {showPaymentResult ? <PaymentResultNotice resolution={resolution} /> : null}

      <dl className="assignment-detail-facts">
        <div>
          <dt>Çalışma zamanı</dt>
          <dd>{formatAssignmentDate(assignment.startsAt, assignment.endsAt)}</dd>
        </div>
        <div>
          <dt>Konum</dt>
          <dd>{[assignment.districtName, assignment.cityName].filter(Boolean).join(", ") || "Bekleniyor"}</dd>
        </div>
        <div>
          <dt>Sıradaki adım</dt>
          <dd>{nextPaymentStep(assignment.status, assignment.paymentStatus)}</dd>
        </div>
      </dl>

      {assignment.pricing ? (
        <section className="assignment-pricing" aria-labelledby="assignment-pricing-title">
          <h2 id="assignment-pricing-title">Atamanın fiyat özeti</h2>
          <PaymentBreakdown pricing={assignment.pricing} />
        </section>
      ) : (
        <div role="status" className="state-card">
          <h2>Fiyat özeti hazırlanıyor</h2>
          <p>Atamanın fiyat bilgisi backend&apos;den henüz gelmedi.</p>
        </div>
      )}

      <EmployerAssignmentPayment assignment={assignment} blocked={blocked} />
    </section>
  );
}

function nextPaymentStep(assignmentStatus: string, paymentStatus: string): string {
  if (paymentStatus === "PENDING_COLLECTION" || paymentStatus === "FAILED") {
    return assignmentStatus === "CONFIRMED"
      ? "Ödemeyi güvenli ödeme sayfasından tamamla."
      : "İşçinin atamayı onaylamasını bekle.";
  }
  if (paymentStatus === "RELEASED_TO_WORKER") return "Para işçiye aktarıldı.";
  if (paymentStatus === "REFUNDED") return "Ödeme iade edildi.";
  if (assignmentStatus === "IN_PROGRESS") return "İş tamamlandığında atamayı tamamlandı olarak işaretle.";
  if (assignmentStatus === "COMPLETED") return "Para işçiye aktarılmak üzere işleniyor.";
  return "İşçinin girişini bekliyor.";
}
