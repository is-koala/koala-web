import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { ShellGate } from "@/app/(uygulama)/shell";
import {
  EmployerPaymentGate,
  PaymentBreakdown,
} from "@/components/payments/employer-payment";
import { ErrorState, LoadingState } from "@/components/states";
import { isUuid } from "@/lib/identifiers";
import { canStartPayment } from "@/payments/checkout";
import type { EmployerAssignment } from "@/payments/contract";
import { failureView } from "@/server/form";
import { fetchPriceQuote } from "@/server/jobs/jobs";
import { readEmployerAssignment } from "@/server/payments/payments";
import { readEmployerPaymentRequirements } from "@/server/payments/preflight";
import { viewerGates } from "@/server/session/gates";
import { enterShell, type Viewer } from "@/server/session/viewer";

import { CheckoutButton } from "@/components/payments/checkout-button";
import { startPaymentAction } from "./actions";

type CheckoutPageProps = { params: Promise<{ assignmentId: string }> };

export default function Page({ params }: CheckoutPageProps) {
  return (
    <ShellGate shell="employer" href="/isveren/atamalar">
      <CheckoutPage params={params} />
    </ShellGate>
  );
}

/** İşveren-scoped ownership doğrulanmadan loading sınırı kurulmaz. */
export async function CheckoutPage({ params }: CheckoutPageProps) {
  const context = await enterShell();
  if (context.failure !== null || context.viewer === null) return null;

  const { assignmentId } = await params;
  if (!isUuid(assignmentId)) notFound();

  const assignmentResult = await readEmployerAssignment(assignmentId)
    .then((assignment) => ({ assignment }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });
  if ("failure" in assignmentResult) {
    return <ErrorState errorCode={assignmentResult.failure.errorCode} status={assignmentResult.failure.httpStatus} />;
  }
  if (assignmentResult.assignment === null) notFound();

  return (
    <Suspense fallback={<LoadingState label="Ödeme özeti yükleniyor" />}>
      <CheckoutContent assignment={assignmentResult.assignment} viewer={context.viewer} />
    </Suspense>
  );
}

export async function CheckoutContent({
  assignment,
  viewer,
}: {
  assignment: EmployerAssignment;
  viewer: Viewer;
}) {
  const [quoteResult, requirementsResult] = await Promise.all([
    assignment.pricing
      ? fetchPriceQuote(assignment.pricing.workerPayout)
          .then((pricing) => ({ pricing }))
          .catch((error: unknown) => {
            unstable_rethrow(error);
            return { failure: failureView(error) };
          })
      : null,
    readEmployerPaymentRequirements(viewerGates(viewer), assignment)
      .then((requirements) => ({ requirements }))
      .catch((error: unknown) => {
        unstable_rethrow(error);
        return { failure: failureView(error) };
      }),
  ]);

  if ("failure" in requirementsResult) {
    return <ErrorState errorCode={requirementsResult.failure.errorCode} status={requirementsResult.failure.httpStatus} />;
  }
  const eligible = canStartPayment(assignment);
  const quoteReady = quoteResult !== null && !("failure" in quoteResult);

  return (
    <section className="app-panel checkout-page">
      <p className="eyebrow">Ödeme öncesi kontrol</p>
      <h1>{assignment.title}</h1>
      <p className="lede">
        İşçi: {assignment.workerName || "Bilgi bekleniyor"}. Kart bilgilerini yalnız Iyzico&apos;nun
        güvenli ödeme sayfasına gireceksin.
      </p>

      <section className="checkout-prerequisites" aria-labelledby="checkout-prerequisites-title">
        <h2 id="checkout-prerequisites-title">Ön koşullar</h2>
        {assignment.employerType === "INDIVIDUAL" ? (
          <ul>
            <li>{viewer.identityVerified ? "Kimlik doğrulandı" : "Kimlik doğrulaması eksik"}</li>
            <li>{viewer.hasIdentityNumber ? "Kimlik numarası kayıtlı" : "Kimlik numarası eksik"}</li>
            <li>{viewer.hasAddress ? "Fatura adresi kayıtlı" : "Fatura adresi eksik"}</li>
          </ul>
        ) : requirementsResult.requirements.advisories.length === 0 &&
          requirementsResult.requirements.blocked.length === 0 ? (
          <p>Şirket yetkin ve şirket fatura adresi doğrulandı.</p>
        ) : (
          <p>Şirket ödeme koşullarındaki eksikleri aşağıdaki yönlendirmelerden tamamlayabilirsin.</p>
        )}
      </section>

      <section className="checkout-breakdown" aria-labelledby="checkout-breakdown-title">
        <h2 id="checkout-breakdown-title">Ödeme özeti</h2>
        {quoteResult === null ? (
          <div role="status" className="state-card">
            <h3>Fiyat özeti bulunamadı</h3>
            <p>Atama fiyatı backend&apos;den gelmeden ödeme başlatılamaz.</p>
          </div>
        ) : "failure" in quoteResult ? (
          <ErrorState errorCode={quoteResult.failure.errorCode} status={quoteResult.failure.httpStatus} />
        ) : (
          <PaymentBreakdown pricing={quoteResult.pricing} />
        )}
      </section>

      {!eligible || !quoteReady ? (
        <div className="payment-disabled-reason">
          <button type="button" className="button button-secondary" disabled>
            Iyzico ile güvenli öde
          </button>
          {!eligible ? <p>Atama onaylanmadan veya ödeme sonucu belirsizken yeni ödeme başlatılamaz.</p> : null}
        </div>
      ) : (
        <EmployerPaymentGate requirements={requirementsResult.requirements} action="Iyzico ile güvenli öde">
          <CheckoutButton action={startPaymentAction.bind(null, assignment.id)} />
        </EmployerPaymentGate>
      )}
    </section>
  );
}
