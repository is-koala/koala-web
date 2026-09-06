import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { ShellGate } from "@/app/(uygulama)/shell";
import { AssignmentResolutionPanel } from "@/components/assignment-resolution";
import { formatAssignmentDate } from "@/components/assignment-presenters";
import { EmployerResolutionActions } from "@/components/employer-resolution-actions";
import {
  DisputeEscrowNotice,
  EmployerAssignmentPayment,
  PaymentBreakdown,
  PaymentResultNotice,
} from "@/components/payments/employer-payment";
import { ErrorState, LoadingState } from "@/components/states";
import { isUuid } from "@/lib/identifiers";
import type { EmployerAssignment } from "@/payments/contract";
import { failureView } from "@/server/form";
import {
  readEmployerAssignment,
  readPaymentDetailsForAssignment,
} from "@/server/payments/payments";
import { readEmployerPaymentRequirements } from "@/server/payments/preflight";
import { readAssignmentResolution } from "@/server/assignments/resolution";
import { viewerGates } from "@/server/session/gates";
import { enterShell, type Viewer } from "@/server/session/viewer";

import { employerResolutionAction } from "./actions";

type EmployerAssignmentPageProps = {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ paymentReturn?: string | string[]; status?: string | string[] }>;
};

export default function Page(props: EmployerAssignmentPageProps) {
  return (
    <ShellGate shell="employer" href="/isveren/atamalar">
      <EmployerAssignmentPage {...props} />
    </ShellGate>
  );
}

/** Ownership ve 404 kararı, herhangi bir streaming sınırından önce tamamlanır. */
export async function EmployerAssignmentPage({ params, searchParams }: EmployerAssignmentPageProps) {
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
    <Suspense fallback={<LoadingState label="Atama ödeme bilgileri yükleniyor" />}>
      <EmployerAssignmentContent
        assignment={result.assignment}
        viewer={context.viewer}
        searchParams={searchParams}
      />
    </Suspense>
  );
}

export async function EmployerAssignmentContent({
  assignment,
  viewer,
  searchParams,
}: {
  assignment: EmployerAssignment;
  viewer: Viewer;
  searchParams: EmployerAssignmentPageProps["searchParams"];
}) {
  const loaded = await Promise.all([
    readPaymentDetailsForAssignment(assignment),
    readEmployerPaymentRequirements(viewerGates(viewer), assignment),
    readAssignmentResolution(assignment.id, assignment.status),
  ]).then(([reconciliation, requirements, resolution]) => ({
    reconciliation,
    requirements,
    resolution,
  }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });
  if ("failure" in loaded) {
    return <ErrorState errorCode={loaded.failure.errorCode} status={loaded.failure.httpStatus} />;
  }

  const query = await searchParams;
  const showPaymentResult = query.paymentReturn === "1";
  const currency = assignment.pricing?.currency ?? "TRY";

  return (
    <section className="app-panel employer-assignment-detail">
      <p className="eyebrow">İşveren ataması</p>
      <h1>{assignment.title}</h1>
      <p className="lede">{assignment.workerName || "İşçi bilgisi bekleniyor"}</p>

      {showPaymentResult ? <PaymentResultNotice resolution={loaded.reconciliation.resolution} /> : null}
      <DisputeEscrowNotice hasActiveDispute={loaded.reconciliation.hasActiveDispute} />

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

      <EmployerAssignmentPayment assignment={assignment} requirements={loaded.requirements} />
      <AssignmentResolutionPanel resolution={loaded.resolution} currency={currency} />
      <EmployerResolutionActions
        assignmentStatus={assignment.status}
        paymentStatus={assignment.paymentStatus}
        resolution={loaded.resolution}
        currency={currency}
        action={employerResolutionAction.bind(null, assignment.id)}
      />
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
