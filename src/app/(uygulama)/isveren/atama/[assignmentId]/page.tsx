import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { ShellGate } from "@/app/(uygulama)/shell";
import {
  assignmentCompletion,
  assignmentNextStep,
  employerAssignmentTimeline,
} from "@/assignments/employer-tracking";
import { showsReviewSection } from "@/assignments/review";
import { ApplicantNameLink } from "@/components/applicant-name-link";
import { AssignmentResolutionPanel } from "@/components/assignment-resolution";
import { AssignmentReviewSection } from "@/components/assignment-review";
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
import { Avatar, PageHeader, PagePanel } from "@/components/ui";
import { isUuid } from "@/lib/identifiers";
import type { EmployerAssignment } from "@/payments/contract";
import { failureView } from "@/server/form";
import {
  readEmployerAssignment,
  readPaymentTimelineForAssignment,
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
  employerReviewAction,
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
    readPaymentTimelineForAssignment(assignment),
    readEmployerPaymentRequirements(viewerGates(viewer), assignment),
    readAssignmentResolution(assignment.id, assignment.status),
    readAssignmentWorkSessions(assignment.id),
  ]).then(([payment, requirements, resolution, sessions]) => ({
    paymentResolution: payment.resolution,
    paymentSecuredAt: payment.securedAt,
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
        lede={assignment.companyName ?? undefined}
      />

      {showPaymentResult ? <PaymentResultNotice resolution={loaded.paymentResolution} /> : null}

      <AssignmentWorkerCard assignment={assignment} />

      <dl className="assignment-detail-facts">
        <div>
          <dt>Çalışma zamanı</dt>
          <dd>{formatAssignmentDate(assignment.startsAt, assignment.endsAt)}</dd>
        </div>
        <div>
          <dt>Konum</dt>
          <dd>{[assignment.districtName, assignment.cityName].filter(Boolean).join(", ") || "Bekleniyor"}</dd>
        </div>
        {/*
          Sıfır saat "henüz çalışılmadı" demek; sayı olarak yazmak
          çalışıldığını ama kaydın boş olduğunu sandırırdı. Değer backend'in
          `workHours` alanı, oturumlardan yeniden hesaplanmıyor.
        */}
        {assignment.workHours > 0 ? (
          <div>
            <dt>Çalışılan saat</dt>
            <dd>{`${assignment.workHours} saat`}</dd>
          </div>
        ) : null}
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
          paymentStatus: assignment.paymentStatus,
          assignedAt: assignment.assignedAt,
          confirmedAt: assignment.confirmedAt,
          paymentSecuredAt: loaded.paymentSecuredAt,
          // İptal anı satırda yoksa (#282 öncesi) iptal kaydından geliyor;
          // sayfa o kaydı uyuşmazlık paneli için zaten okuyor.
          cancelledAt: assignment.cancelledAt ?? loaded.resolution.cancellation?.cancelledAt ?? null,
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

      {/*
        Değerlendirme takip panelinin hemen altında: "iş bitti" adımının
        doğal devamı. Bölüm yalnız `COMPLETED` atamada (`canReviewAssignment`,
        kural tek yerde); backend başka durumda 409 döndürüyor ve karar
        satırdan okunabiliyor (#173). Form ise ancak satır `myReview`
        taşımıyorsa açılıyor (#179): varsa yükleme anında özet, 409 yolu
        yarış yedeği.
      */}
      {showsReviewSection(assignment.status, assignment.myReview) ? (
        <AssignmentReviewSection
          workerName={assignment.workerName || "İşçi"}
          action={employerReviewAction.bind(null, assignment.id)}
          existing={assignment.myReview}
          counterpartyReviewed={assignment.counterpartyReviewed}
        />
      ) : null}

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

/**
 * İşçi kartı: fotoğraf, ad ve aday dosyasına bağlantı.
 *
 * Ad başlığın altındaki `lede`'den karta taşındı: orada düz bir metindi ve
 * işçinin kim olduğuna bakmanın yolu yoktu. Dosya sayfası (`/isveren/aday`)
 * başvuru kartındaki panelin aynısını gösteriyor; kimlik `MyAssignmentDto.
 * worker.id` ve UUID değilse bağlantı çizilmiyor.
 */
function AssignmentWorkerCard({ assignment }: { assignment: EmployerAssignment }) {
  const name = assignment.workerName || "İşçi bilgisi bekleniyor";
  return (
    <div className="work-employer assignment-worker" data-testid="assignment-worker">
      <Avatar name={assignment.workerName || "?"} src={assignment.workerPictureUrl} size="lg" />
      <div className="work-employer-copy">
        <span className="muted">İşçi</span>
        <strong>{name}</strong>
        <ApplicantNameLink workerId={assignment.workerId} name={name} label="Aday dosyasını aç" />
      </div>
    </div>
  );
}
