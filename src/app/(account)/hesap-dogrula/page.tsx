import type { Metadata } from "next";
import { headers } from "next/headers";
import { OpenInApp } from "@/components/open-in-app";
import { deepLink, detectPlatform, storeLink } from "@/lib/platform";

export const metadata: Metadata = { title: "Hesabını Doğrula" };

/**
 * E-postadaki doğrulama bağlantısının indiği yer.
 *
 * Karar sunucuda veriliyor: mobilse uygulamaya (yoksa mağazaya), masaüstünde
 * akış web'de tamamlanıyor. Böylece bilgisayarından mail okuyan kullanıcı
 * çıkmaz sokakta kalmıyor.
 *
 * Next 16'da `searchParams` bir Promise — await edilmeden okunamaz.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const platform = detectPlatform((await headers()).get("user-agent"));

  if (!token) {
    return (
      <p className="text-neutral-600">
        Bu bağlantı geçersiz görünüyor. Lütfen e-postandaki bağlantıya yeniden tıkla.
      </p>
    );
  }

  if (platform !== "desktop") {
    return (
      <OpenInApp
        deepLink={deepLink("hesap-dogrula", token)}
        storeLink={storeLink(platform)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Hesabını doğrula</h1>
      {/*
        TODO(#1 Faz 0): masaüstü akışı. Token backend'e doğrulatılıp şifre
        belirleme formu gösterilecek. Uçlar hazır:
          POST /auth/verify-registration-token
          GET  /legal/agreements
          POST /auth/complete-registration
      */}
      <p className="text-neutral-600">
        Doğrulama akışı hazırlanıyor.
      </p>
    </div>
  );
}
