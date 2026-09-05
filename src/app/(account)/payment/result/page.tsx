import type { Metadata } from "next";
import { OpenInApp } from "@/components/open-in-app";
import { paymentContent } from "@/content/account";
import { buildAndroidPaymentResultIntentUrl, buildPaymentResultLink, storeUrl } from "@/handoff/links";
import { readSingleToken, type SearchValue } from "@/handoff/token";
import { publicEnvironment } from "@/lib/env";

export const metadata: Metadata = { title: "Ödeme Sonucu", robots: { index: false, follow: false } };

/**
 * Iyzico ödemesinden dönüşün indiği yer.
 *
 * Bu rotanın adı Türkçe DEĞİL ve öyle kalmalı: adresi backend
 * `payments.return-base-url` sözleşmesiyle kuruyor.
 * Burayı yeniden adlandırmak ödeme dönüşünü kırar.
 *
 * Dönüş parametreleri finansal gerçek SAYILMAZ (ADR-0004). Sayfa yalnız
 * kullanıcıyı doğru yere taşır; sonucun kendisi backend'den doğrulanır.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: SearchValue; assignmentId?: SearchValue }>;
}) {
  const { status: statusValue, assignmentId: assignmentIdValue } = await searchParams;
  const env = publicEnvironment();
  const assignmentId = readSingleToken(assignmentIdValue);
  const status = typeof statusValue === "string" ? statusValue : undefined;

  if ((status !== "success" && status !== "failed") || !assignmentId.ok) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold">{paymentContent.invalidTitle}</h1>
        <p className="text-neutral-600">{paymentContent.invalidBody}</p>
      </div>
    );
  }

  const androidStore = storeUrl("android", env);
  const androidIntent = env.androidPackageId && androidStore
    ? buildAndroidPaymentResultIntentUrl({
        status,
        assignmentId: assignmentId.value,
        scheme: env.appUrlScheme,
        packageId: env.androidPackageId,
        fallbackUrl: androidStore,
      })
    : undefined;

  return (
    <section className="account-card">
      <p className="eyebrow">{paymentContent.eyebrow}</p>
      <h1>{status === "success" ? paymentContent.successTitle : paymentContent.failedTitle}</h1>
      <p className="lede">{paymentContent.body}</p>
      <OpenInApp
        deepLink={buildPaymentResultLink({ status, assignmentId: assignmentId.value, scheme: env.appUrlScheme })}
        androidIntentLink={androidIntent}
        storeLink={storeUrl("ios", env)}
        androidStoreLink={androidStore}
      />
      <noscript>
        <p>
          <a href={buildPaymentResultLink({ status, assignmentId: assignmentId.value, scheme: env.appUrlScheme })}>
            Koala uygulamasını aç
          </a>
        </p>
        {androidStore && <p><a href={androidStore}>Play Store&apos;a git</a></p>}
      </noscript>
    </section>
  );
}
