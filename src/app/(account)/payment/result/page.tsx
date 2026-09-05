import type { Metadata } from "next";
import { headers } from "next/headers";
import { OpenInApp } from "@/components/open-in-app";
import { detectPlatform, paymentResultDeepLink, storeLink } from "@/lib/platform";

export const metadata: Metadata = { title: "Ödeme Sonucu" };

/**
 * Iyzico ödemesinden dönüşün indiği yer.
 *
 * Bu rotanın adı Türkçe DEĞİL ve öyle kalmalı: adresi backend kuruyor
 * (`PaymentsController.java:88`, `app.frontend-url + "/payment/result"`).
 * Burayı yeniden adlandırmak ödeme dönüşünü kırar.
 *
 * Dönüş parametreleri finansal gerçek SAYILMAZ (ADR-0004). Sayfa yalnız
 * kullanıcıyı doğru yere taşır; sonucun kendisi backend'den doğrulanır.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assignmentId?: string }>;
}) {
  const { status, assignmentId } = await searchParams;
  const platform = detectPlatform((await headers()).get("user-agent"));

  if (!status || !assignmentId) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Ödeme sonucu okunamadı</h1>
        <p className="text-neutral-600">
          Ödemenin durumunu uygulamadaki iş detayından kontrol edebilirsin.
        </p>
      </div>
    );
  }

  if (platform !== "desktop") {
    return (
      <OpenInApp
        deepLink={paymentResultDeepLink(status, assignmentId)}
        storeLink={storeLink(platform)}
      />
    );
  }

  return (
    <div className="space-y-3 text-center">
      <h1 className="text-2xl font-semibold">Ödemen alındı</h1>
      <p className="text-neutral-600">
        {/*
          TODO(#1): backend'den doğrulanmış ödeme durumu sorgulanacak.
          Dönüş parametresi finansal gerçek değildir (ADR-0004).
        */}
        İşin ayrıntılarını Koala uygulamasından takip edebilirsin.
      </p>
    </div>
  );
}
