import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";

import { OpenInApp } from "@/components/open-in-app";
import { PaymentResultWait } from "@/components/payments/payment-result-wait";
import { ErrorState } from "@/components/states";
import { paymentContent } from "@/content/account";
import {
  buildAndroidPaymentResultIntentUrl,
  buildPaymentResultLink,
  resolvePlatform,
  storeUrl,
} from "@/handoff/links";
import { readSingleToken, type SearchValue } from "@/handoff/token";
import { publicEnvironment } from "@/lib/env";
import { isUuid } from "@/lib/identifiers";
import { paymentReturnToneTitle } from "@/payments/checkout";
import { failureView } from "@/server/form";
import { readPaymentReconciliation } from "@/server/payments/payments";
import { requireSessionForCurrentPath } from "@/server/session/guard";
import { readSession } from "@/server/session/session";

export const metadata: Metadata = {
  title: "Ödeme Sonucu",
  robots: { index: false, follow: false },
};

type PaymentResultPageProps = {
  searchParams: Promise<{ status?: SearchValue; assignmentId?: SearchValue }>;
};

/** Query yalnız dönüş biçimi ve handoff tonu; finansal sonuç backend'den okunur. */
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

  const session = await readSession();
  if (!session.refreshToken) {
    const platform = resolvePlatform((await headers()).get("user-agent"));
    if (platform !== "desktop") {
      return <PaymentResultHandoff status={status} assignmentId={assignmentId.value} />;
    }
    await requireSessionForCurrentPath();
    return null;
  }

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

  return <PaymentResultWait assignmentId={assignmentId.value} initialTone={status} />;
}

function PaymentResultHandoff({
  status,
  assignmentId,
}: {
  status: "success" | "failed";
  assignmentId: string;
}) {
  const env = publicEnvironment();
  const deepLink = buildPaymentResultLink({ status, assignmentId, scheme: env.appUrlScheme });
  const androidStore = storeUrl("android", env);
  const androidIntent = env.androidPackageId && androidStore
    ? buildAndroidPaymentResultIntentUrl({
        status,
        assignmentId,
        scheme: env.appUrlScheme,
        packageId: env.androidPackageId,
        fallbackUrl: androidStore,
      })
    : undefined;

  return (
    <section className="account-card">
      <p className="eyebrow">{paymentContent.eyebrow}</p>
      <h1>{paymentReturnToneTitle(status)}</h1>
      <p className="lede">
        Bu bildirim tek başına finansal sonuç değildir. Doğrulanmış durumu Koala uygulamasından takip edebilirsin.
      </p>
      <OpenInApp
        deepLink={deepLink}
        androidIntentLink={androidIntent}
        storeLink={storeUrl("ios", env)}
        androidStoreLink={androidStore}
      />
      <noscript>
        <p><a href={deepLink}>Koala uygulamasını aç</a></p>
        {androidStore ? <p><a href={androidStore}>Play Store&apos;a git</a></p> : null}
      </noscript>
    </section>
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
