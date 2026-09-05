import type { Metadata } from "next";
import { headers } from "next/headers";
import { OpenInApp } from "@/components/open-in-app";
import { detectPlatform, openAppLink, storeLink } from "@/lib/platform";

export const metadata: Metadata = { title: "Uygulamayı Aç" };

/** Token taşımayan genel giriş: kullanıcıyı uygulamaya ya da mağazaya yollar. */
export default async function Page() {
  const platform = detectPlatform((await headers()).get("user-agent"));

  if (platform === "desktop") {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Koala&apos;yı telefonuna kur</h1>
        <p className="text-neutral-600">
          Koala mobil bir uygulama. Telefonundan bu sayfayı açarak devam edebilirsin.
        </p>
        {/* TODO(#1 Faz 0): mağaza rozetleri ve QR kodu. */}
      </div>
    );
  }

  return <OpenInApp deepLink={openAppLink()} storeLink={storeLink(platform)} />;
}
