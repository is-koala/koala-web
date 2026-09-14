import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { ShellGate } from "@/app/(uygulama)/shell";
import {
  assignmentCompletion,
  assignmentNextStep,
  employerAssignmentTimeline,
} from "@/assignments/employer-tracking";
import { AssignmentResolutionPanel } from "@/components/assignment-resolution";
import { EmployerAssignmentTracking } from "@/components/assignment-tracking";
import { formatAssignmentDate } from "@/components/assignment-presenters";
import { EmployerResolutionActions } from "@/components/employer-resolution-actions";
import { AssignmentMessaging } from "@/components/messaging/assignment-messaging";
import {
  EmployerAssignmentPayment,
  PaymentBreakdown,
  PaymentResultNotice,
} from "@/components/payments/employer-payment";
import { ErrorState, LoadingState } from "@/components/states";
import { PageHeader, PagePanel } from "@/components/ui";
import { isUuid } from "@/lib/identifiers";
import type { EmployerAssignment } from "@/payments/contract";
import { failureView } from "@/server/form";
import {
  readEmployerAssignment,
  readPaymentResolutionForAssignment,
} from "@/server/payments/payments";
import { readEmployerPaymentRequirements } from "@/server/payments/preflight";
import { readAssignmentResolution } from "@/server/assignments/resolution";
import { readAssignmentWorkSessions } from "@/server/assignments/employer-tracking";
import { viewerGates } from "@/server/session/gates";
import { enterShell, type Viewer } from "@/server/session/viewer";

import {
  completeAssignmentAction,
  employerConversationAction,
  employerResolutionAction,
} from "./actions";

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
    readPaymentResolutionForAssignment(assignment),
    readEmployerPaymentRequirements(viewerGates(viewer), assignment),
    readAssignmentResolution(assignment.id, assignment.status),
    readAssignmentWorkSessions(assignment.id),
  ]).then(([paymentResolution, requirements, resolution, sessions]) => ({
    paymentResolution,
    requirements,
    resolution,
    sessions,
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
    <PagePanel className="employer-assignment-detail">
      <PageHeader
        eyebrow="İşveren ataması"
        title={assignment.title}
        lede={assignment.workerName || "İşçi bilgisi bekleniyor"}
      />

      {showPaymentResult ? <PaymentResultNotice resolution={loaded.paymentResolution} /> : null}

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
          <dd>{assignmentNextStep(assignment.status, assignment.paymentStatus)}</dd>
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

      {/*
        Takip paneli ödemeden önce duruyor: "iş nerede" sorusu, "ne ödeyeceğim"
        sorusundan önce geliyor ve tamamlama düğmesinin neden kapalı olduğunu
        çizelge zaten anlatıyor.
      */}
      <EmployerAssignmentTracking
        timeline={employerAssignmentTimeline({
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          completedAt: assignment.completedAt,
          sessions: loaded.sessions,
        })}
        sessions={loaded.sessions}
        completion={assignmentCompletion({
          assignmentStatus: assignment.status,
          paymentStatus: assignment.paymentStatus,
        })}
        action={completeAssignmentAction.bind(null, assignment.id)}
      />

      <EmployerAssignmentPayment assignment={assignment} requirements={loaded.requirements} />

      {/*
        Mesajlaşma ödeme kartının hemen altında: kapı ödemeye bağlı ve
        "Ödemeyi tamamla" bağlantısı kullanıcıyı bir üstteki karta değil,
        ödeme akışına götürüyor. Karar sunucudan (`messagingAvailable`);
        alan yoksa bölüm hiç çizilmiyor (#157).
      */}
      <AssignmentMessaging
        availability={assignment.messaging}
        party="employer"
        assignmentId={assignment.id}
        action={employerConversationAction.bind(null, assignment.jobId, assignment.workerId)}
      />

      <AssignmentResolutionPanel resolution={loaded.resolution} currency={currency} />
      <EmployerResolutionActions
        assignmentStatus={assignment.status}
        paymentStatus={assignment.paymentStatus}
        resolution={loaded.resolution}
        currency={currency}
        action={employerResolutionAction.bind(null, assignment.id)}
      />
    </PagePanel>
  );
}
